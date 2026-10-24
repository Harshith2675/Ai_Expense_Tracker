"""
services/auto_detection_service.py — Core business logic for Automatic Expense Detection.
Handles idempotent syncing, duplicate checks, transaction normalization, and user review flow.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from database.db import get_db_connection, dollars_to_cents, cents_to_dollars, row_to_dict
from services.providers.factory import get_banking_provider, list_supported_providers
from services.providers.base import NormalizedTransaction
from api.transactions import ALL_CATEGORIES, PAYMENT_METHODS


class AutoDetectionService:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def get_status(self, mode_override: Optional[str] = None) -> Dict[str, Any]:
        """Return connectivity status, provider configuration, and detection statistics."""
        provider = get_banking_provider(mode_override)
        provider_status = provider.get_status()

        with get_db_connection(self.db_path) as conn:
            # Last sync info
            last_sync_row = conn.execute(
                "SELECT timestamp, status, transactions_imported, transactions_pending "
                "FROM sync_history WHERE status = 'success' "
                "ORDER BY id DESC LIMIT 1"
            ).fetchone()

            # Counts
            detected_total = conn.execute(
                "SELECT COUNT(*) FROM transactions WHERE detection_method = 'automatic'"
            ).fetchone()[0]

            pending_count = conn.execute(
                "SELECT COUNT(*) FROM transactions WHERE review_status = 'pending_review'"
            ).fetchone()[0]

            approved_auto_count = conn.execute(
                "SELECT COUNT(*) FROM transactions "
                "WHERE detection_method = 'automatic' AND review_status = 'approved'"
            ).fetchone()[0]

        last_sync_time = last_sync_row["timestamp"] if last_sync_row else None

        return {
            "provider_id": provider.provider_id,
            "provider_name": provider.display_name,
            "is_configured": provider.is_configured(),
            "is_demo": provider_status.get("is_demo", False),
            "mode": provider_status.get("mode", "demo"),
            "connection_status": provider_status.get("connection_status", "disconnected"),
            "message": provider_status.get("message", ""),
            "last_sync": last_sync_time,
            "detected_count": detected_total,
            "pending_count": pending_count,
            "approved_auto_count": approved_auto_count,
            "supported_providers": list_supported_providers(),
            "real_provider_configured": provider.provider_id != "demo_bank" and provider.is_configured(),
        }

    def sync(self, mode_override: Optional[str] = None) -> Dict[str, Any]:
        """
        Execute an idempotent synchronization with the active financial provider.
        - Checks for existing external_id per provider to prevent duplicates.
        - Categorizes and flags uncertain transactions for user review.
        - Accurately tracks income vs expense and refunds.
        """
        provider = get_banking_provider(mode_override)
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        if provider.provider_id == "disconnected":
            self._record_sync_history(
                provider="disconnected",
                sync_mode="disconnected",
                status="failed",
                found=0, imported=0, pending=0,
                error="Sync cannot run in disconnected mode. Select Demo mode or configure an authorized provider."
            )
            return {
                "success": False,
                "error": "Automatic detection is currently disconnected. Connect a provider or enable Demo mode.",
                "connection_status": "disconnected"
            }

        if not provider.is_configured():
            err_msg = f"{provider.display_name} is not configured with valid API credentials."
            self._record_sync_history(
                provider=provider.provider_id,
                sync_mode="real",
                status="failed",
                found=0, imported=0, pending=0,
                error=err_msg
            )
            return {
                "success": False,
                "error": err_msg,
                "connection_status": "unconfigured"
            }

        try:
            feed: List[NormalizedTransaction] = provider.fetch_transactions()
        except Exception as e:
            self._record_sync_history(
                provider=provider.provider_id,
                sync_mode="demo" if provider.get_status().get("is_demo") else "real",
                status="error",
                found=0, imported=0, pending=0,
                error=str(e)
            )
            return {
                "success": False,
                "error": f"Provider communication failure: {str(e)}",
            }

        imported_approved = 0
        imported_pending = 0
        duplicates_skipped = 0

        with get_db_connection(self.db_path) as conn:
            for item in feed:
                # Duplicate prevention: Check if external_id already imported for this provider
                existing = conn.execute(
                    "SELECT id FROM transactions WHERE provider = ? AND external_id = ?",
                    (provider.provider_id, item.external_id)
                ).fetchone()

                if existing:
                    duplicates_skipped += 1
                    continue

                # Ensure category is valid
                category = item.suggested_category if item.suggested_category in ALL_CATEGORIES else "Other"
                review_status = "pending_review" if item.requires_review else "approved"
                amount_cents = dollars_to_cents(item.amount)

                conn.execute(
                    """
                    INSERT INTO transactions
                        (user_id, transaction_type, category, description, payment_method,
                         amount_cents, transaction_date, notes, detection_method,
                         external_id, provider, review_status, sync_timestamp, is_demo,
                         created_at, updated_at)
                    VALUES
                        (1, ?, ?, ?, ?, ?, ?, ?, 'automatic', ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        item.transaction_type,
                        category,
                        item.description.strip(),
                        item.payment_method if item.payment_method in PAYMENT_METHODS else "Other",
                        amount_cents,
                        item.transaction_date,
                        item.notes or f"Imported via {provider.display_name}",
                        item.external_id,
                        provider.provider_id,
                        review_status,
                        now_str,
                        1 if item.is_demo else 0,
                        now_str,
                        now_str
                    )
                )

                if review_status == "approved":
                    imported_approved += 1
                else:
                    imported_pending += 1

            conn.commit()

        # Record successful sync history
        self._record_sync_history(
            provider=provider.provider_id,
            sync_mode="demo" if provider.get_status().get("is_demo") else "real",
            status="success",
            found=len(feed),
            imported=imported_approved,
            pending=imported_pending
        )

        return {
            "success": True,
            "status": "success",
            "provider_id": provider.provider_id,
            "provider_name": provider.display_name,
            "is_demo": provider.get_status().get("is_demo", False),
            "synced_at": now_str,
            "summary": {
                "total_found": len(feed),
                "imported_approved": imported_approved,
                "imported_pending_review": imported_pending,
                "duplicates_skipped": duplicates_skipped,
            },
            "message": (
                f"Sync completed successfully. {imported_approved} approved, "
                f"{imported_pending} pending review, {duplicates_skipped} existing transactions skipped."
            ),
        }

    def get_pending_transactions(self) -> List[Dict[str, Any]]:
        """Fetch all transactions awaiting user review and approval."""
        with get_db_connection(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, transaction_type, category, description, payment_method,
                       amount_cents, transaction_date, notes, detection_method,
                       external_id, provider, review_status, sync_timestamp, is_demo,
                       created_at, updated_at
                FROM transactions
                WHERE review_status = 'pending_review'
                ORDER BY transaction_date DESC, id DESC
                """
            ).fetchall()

        results = []
        for r in rows:
            d = row_to_dict(r)
            results.append({
                "id": d["id"],
                "external_id": d["external_id"],
                "provider": d["provider"],
                "transaction_type": d["transaction_type"],
                "category": d["category"],
                "suggested_category": d["category"],
                "description": d["description"],
                "payment_method": d["payment_method"],
                "amount": cents_to_dollars(d["amount_cents"]),
                "transaction_date": d["transaction_date"],
                "notes": d["notes"] or "",
                "review_status": d["review_status"],
                "is_demo": bool(d["is_demo"]),
                "created_at": d["created_at"],
            })
        return results

    def review_transaction(
        self,
        tx_id: int,
        action: str,
        category: Optional[str] = None,
        transaction_type: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Confirm, edit, or reject a pending transaction.
        - action='approve': sets review_status='approved', updates category/type if specified.
        - action='reject': sets review_status='rejected' (does not delete row, ensures auditability).
        """
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        with get_db_connection(self.db_path) as conn:
            existing = conn.execute(
                "SELECT * FROM transactions WHERE id = ?", (tx_id,)
            ).fetchone()

            if not existing:
                return {"success": False, "error": f"Transaction {tx_id} not found."}

            existing_dict = row_to_dict(existing)

            if action == "approve":
                cat = category if (category and category in ALL_CATEGORIES) else existing_dict["category"]
                t_type = transaction_type if (transaction_type in ("expense", "income")) else existing_dict["transaction_type"]
                updated_notes = (notes.strip() if notes else existing_dict.get("notes")) or ""

                conn.execute(
                    """
                    UPDATE transactions
                    SET review_status = 'approved',
                        category = ?,
                        transaction_type = ?,
                        notes = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (cat, t_type, updated_notes, now_str, tx_id)
                )
                conn.commit()

                updated_row = conn.execute("SELECT * FROM transactions WHERE id = ?", (tx_id,)).fetchone()
                d = row_to_dict(updated_row)
                return {
                    "success": True,
                    "action": "approved",
                    "transaction": {
                        "id": d["id"],
                        "transaction_type": d["transaction_type"],
                        "category": d["category"],
                        "description": d["description"],
                        "amount": cents_to_dollars(d["amount_cents"]),
                        "transaction_date": d["transaction_date"],
                        "review_status": d["review_status"],
                    }
                }

            elif action == "reject":
                conn.execute(
                    "UPDATE transactions SET review_status = 'rejected', updated_at = ? WHERE id = ?",
                    (now_str, tx_id)
                )
                conn.commit()
                return {"success": True, "action": "rejected", "id": tx_id}

            else:
                return {"success": False, "error": f"Invalid review action: '{action}'. Choose 'approve' or 'reject'."}

    def review_all_pending(self, action: str) -> Dict[str, Any]:
        """Approve or reject all pending transactions in bulk."""
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        new_status = "approved" if action == "approve" else "rejected"

        with get_db_connection(self.db_path) as conn:
            cur = conn.execute(
                "UPDATE transactions SET review_status = ?, updated_at = ? WHERE review_status = 'pending_review'",
                (new_status, now_str)
            )
            conn.commit()
            count = cur.rowcount

        return {
            "success": True,
            "action": new_status,
            "updated_count": count,
            "message": f"Successfully marked {count} transactions as {new_status}."
        }

    def get_sync_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve recent sync execution logs."""
        with get_db_connection(self.db_path) as conn:
            rows = conn.execute(
                """
                SELECT id, provider, sync_mode, status, transactions_found,
                       transactions_imported, transactions_pending, error_message, timestamp
                FROM sync_history
                ORDER BY id DESC LIMIT ?
                """,
                (limit,)
            ).fetchall()
        return [row_to_dict(r) for r in rows]

    def _record_sync_history(
        self,
        provider: str,
        sync_mode: str,
        status: str,
        found: int,
        imported: int,
        pending: int,
        error: Optional[str] = None
    ) -> None:
        """Internal audit recorder for sync attempts."""
        try:
            with get_db_connection(self.db_path) as conn:
                conn.execute(
                    """
                    INSERT INTO sync_history
                        (provider, sync_mode, status, transactions_found,
                         transactions_imported, transactions_pending, error_message)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (provider, sync_mode, status, found, imported, pending, error)
                )
                conn.commit()
        except Exception as e:
            # Non-blocking for primary transaction flow
            print(f"[SyncHistory] Warning: Failed to record sync log: {e}")
