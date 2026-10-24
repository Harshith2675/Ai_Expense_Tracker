"""
services/budget_service.py — Core business logic for Budget Management.
Handles budget creation, editing, deletion, uniqueness validation, and dynamic
spending calculations from actual transactions stored in SQLite.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from database.db import get_db_connection, dollars_to_cents, cents_to_dollars, row_to_dict
from api.transactions import EXPENSE_CATEGORIES


class BudgetService:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def get_budgets(self, month: int, year: int, currency: str = "USD") -> List[Dict[str, Any]]:
        """
        Fetch all category budgets for the specified month/year with live calculated spending,
        remaining cushion, usage percentage, and threshold status (normal, warning, exceeded).
        """
        sym = "₹" if (currency or "").upper() == "INR" else "$"
        with get_db_connection(self.db_path) as conn:
            budget_rows = conn.execute(
                """
                SELECT id, category, amount_cents, period, budget_month, budget_year,
                       notes, created_at, updated_at
                FROM budgets
                WHERE budget_year = ? AND budget_month = ?
                ORDER BY amount_cents DESC, category ASC
                """,
                (year, month)
            ).fetchall()

            # Query spending per category for this month
            # Expenses only, approved transactions only
            spending_rows = conn.execute(
                """
                SELECT category, COALESCE(SUM(amount_cents), 0) AS spent_cents
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                GROUP BY category
                """,
                (str(year), month)
            ).fetchall()

        spending_map = {r["category"]: r["spent_cents"] for r in spending_rows}

        results = []
        for row in budget_rows:
            d = row_to_dict(row)
            cat = d["category"]
            budget_amount = cents_to_dollars(d["amount_cents"])
            spent_cents = spending_map.get(cat, 0)
            spent_amount = cents_to_dollars(spent_cents)

            remaining = round(budget_amount - spent_amount, 2)
            over_budget = round(max(0.0, spent_amount - budget_amount), 2)
            pct = round((spent_amount / budget_amount * 100), 1) if budget_amount > 0 else 0.0

            if spent_amount > budget_amount:
                status = "exceeded"
                status_label = "Exceeded"
                alert_message = f"Over budget by {sym}{over_budget:.2f}"
            elif pct >= 80.0:
                status = "warning"
                status_label = "Near Limit"
                alert_message = f"Approaching limit: {pct}% used ({sym}{max(0.0, remaining):.2f} left)"
            else:
                status = "normal"
                status_label = "On Track"
                alert_message = f"{sym}{remaining:.2f} remaining"

            results.append({
                "id": d["id"],
                "category": cat,
                "amount": budget_amount,
                "period": d.get("period", "monthly"),
                "month": d["budget_month"],
                "year": d["budget_year"],
                "notes": d.get("notes") or "",
                "spent": spent_amount,
                "remaining": max(0.0, remaining),
                "over_budget": over_budget,
                "net_remaining": remaining,
                "percentage_used": pct,
                "status": status,
                "status_label": status_label,
                "alert_message": alert_message,
                "created_at": d.get("created_at"),
                "updated_at": d.get("updated_at"),
            })

        return results

    def get_budget_summary(self, month: int, year: int, currency: str = "USD") -> Dict[str, Any]:
        """
        Calculate aggregate budget totals for the selected period:
        - Total allocated budget across all categories
        - Total actual expenses in that month
        - Remaining cushion / over-budget variance
        - Overall usage percentage
        - List of active alerts (warning and exceeded thresholds)
        """
        budgets = self.get_budgets(month, year, currency=currency)

        with get_db_connection(self.db_path) as conn:
            # Total expenses in that entire month
            month_exp_row = conn.execute(
                """
                SELECT COALESCE(SUM(amount_cents), 0) AS total_spent_cents
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                """,
                (str(year), month)
            ).fetchone()

        total_spent = cents_to_dollars(month_exp_row["total_spent_cents"])
        total_budget = round(sum(b["amount"] for b in budgets), 2)
        total_remaining = round(total_budget - total_spent, 2)
        overall_pct = (
            round((total_spent / total_budget * 100), 1)
            if total_budget > 0 else 0.0
        )

        warning_alerts = [b for b in budgets if b["status"] == "warning"]
        exceeded_alerts = [b for b in budgets if b["status"] == "exceeded"]

        is_over = (total_spent > total_budget) if total_budget > 0 else False

        return {
            "month": month,
            "year": year,
            "total_budget": total_budget,
            "total_expenses": total_spent,
            "remaining_budget": max(0.0, total_remaining),
            "net_balance": total_remaining,
            "is_over_budget": is_over,
            "budget_used_percentage": overall_pct,
            "category_count": len(budgets),
            "warning_count": len(warning_alerts),
            "exceeded_count": len(exceeded_alerts),
            "alerts": [
                {
                    "category": b["category"],
                    "budget": b["amount"],
                    "spent": b["spent"],
                    "percentage_used": b["percentage_used"],
                    "status": b["status"],
                    "message": b["alert_message"],
                    "remaining": b["remaining"],
                    "over_budget": b["over_budget"]
                }
                for b in (exceeded_alerts + warning_alerts)
            ]
        }

    def create_budget(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new monthly category budget with validation:
        - Category must be a recognized expense category
        - Amount must be positive
        - No duplicate budget for the same category in the same month/year
        """
        now = datetime.now()
        category = (data.get("category") or "").strip()
        raw_amount = data.get("amount")
        month = data.get("month", now.month)
        year = data.get("year", now.year)
        period = data.get("period", "monthly")
        notes = (data.get("notes") or "").strip()

        # Validation
        if not category:
            return {"success": False, "error": "Category is required."}
        if category not in EXPENSE_CATEGORIES:
            return {
                "success": False,
                "error": f"Invalid category '{category}'. Must be one of: {', '.join(EXPENSE_CATEGORIES)}."
            }

        try:
            amount_val = float(raw_amount)
            if amount_val <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            return {"success": False, "error": "Budget amount must be a positive number greater than 0."}

        try:
            month = int(month)
            if not (1 <= month <= 12):
                raise ValueError()
        except (TypeError, ValueError):
            return {"success": False, "error": "Month must be an integer between 1 and 12."}

        try:
            year = int(year)
            if year < 2000 or year > 2100:
                raise ValueError()
        except (TypeError, ValueError):
            return {"success": False, "error": "Year must be a valid 4-digit year between 2000 and 2100."}

        amount_cents = dollars_to_cents(amount_val)
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

        with get_db_connection(self.db_path) as conn:
            # Check for existing budget for category + month + year
            existing = conn.execute(
                """
                SELECT id FROM budgets
                WHERE category = ? AND budget_year = ? AND budget_month = ?
                """,
                (category, year, month)
            ).fetchone()

            if existing:
                return {
                    "success": False,
                    "error": f"A budget for '{category}' already exists for {month:02d}/{year}. You can edit the existing budget."
                }

            cur = conn.execute(
                """
                INSERT INTO budgets (
                    category, amount_cents, period, budget_month, budget_year,
                    month, year, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (category, amount_cents, period, month, year, month, year, notes, now_str, now_str)
            )
            conn.commit()
            new_id = cur.lastrowid

        return {
            "success": True,
            "data": {
                "id": new_id,
                "category": category,
                "amount": amount_val,
                "period": period,
                "month": month,
                "year": year,
                "notes": notes,
                "created_at": now_str,
                "updated_at": now_str,
            }
        }

    def get_budget(self, budget_id: int) -> Optional[Dict[str, Any]]:
        """Retrieve a single budget record by ID with current live spending figures."""
        with get_db_connection(self.db_path) as conn:
            row = conn.execute(
                "SELECT * FROM budgets WHERE id = ?", (budget_id,)
            ).fetchone()

        if not row:
            return None

        d = row_to_dict(row)
        month = d["budget_month"]
        year = d["budget_year"]
        category = d["category"]

        with get_db_connection(self.db_path) as conn:
            spending_row = conn.execute(
                """
                SELECT COALESCE(SUM(amount_cents), 0) AS spent_cents
                FROM transactions
                WHERE transaction_type = 'expense'
                  AND (review_status IS NULL OR review_status = 'approved')
                  AND strftime('%Y', transaction_date) = ?
                  AND CAST(strftime('%m', transaction_date) AS INTEGER) = ?
                  AND category = ?
                """,
                (str(year), month, category)
            ).fetchone()

        budget_amount = cents_to_dollars(d["amount_cents"])
        spent_amount = cents_to_dollars(spending_row["spent_cents"])
        remaining = round(budget_amount - spent_amount, 2)
        pct = round((spent_amount / budget_amount * 100), 1) if budget_amount > 0 else 0.0

        return {
            "id": d["id"],
            "category": category,
            "amount": budget_amount,
            "period": d.get("period", "monthly"),
            "month": month,
            "year": year,
            "notes": d.get("notes") or "",
            "spent": spent_amount,
            "remaining": max(0.0, remaining),
            "percentage_used": pct,
            "created_at": d.get("created_at"),
            "updated_at": d.get("updated_at"),
        }

    def update_budget(self, budget_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing budget's amount, notes, or category."""
        with get_db_connection(self.db_path) as conn:
            existing = conn.execute("SELECT * FROM budgets WHERE id = ?", (budget_id,)).fetchone()
            if not existing:
                return {"success": False, "error": f"Budget {budget_id} not found."}

            existing_dict = row_to_dict(existing)

            # Amount validation
            if "amount" in data and data["amount"] is not None:
                try:
                    amount_val = float(data["amount"])
                    if amount_val <= 0:
                        raise ValueError()
                    amount_cents = dollars_to_cents(amount_val)
                except (TypeError, ValueError):
                    return {"success": False, "error": "Budget amount must be a positive number greater than 0."}
            else:
                amount_cents = existing_dict["amount_cents"]
                amount_val = cents_to_dollars(amount_cents)

            # Category validation
            if "category" in data and data["category"]:
                cat = data["category"].strip()
                if cat not in EXPENSE_CATEGORIES:
                    return {"success": False, "error": f"Invalid category '{cat}'."}
            else:
                cat = existing_dict["category"]

            # Month & Year check
            month = int(data.get("month", existing_dict["budget_month"]))
            year = int(data.get("year", existing_dict["budget_year"]))
            notes = data.get("notes", existing_dict["notes"])
            if notes is not None:
                notes = str(notes).strip()

            # Duplicate conflict check if category, month or year changed
            if cat != existing_dict["category"] or month != existing_dict["budget_month"] or year != existing_dict["budget_year"]:
                conflict = conn.execute(
                    "SELECT id FROM budgets WHERE category = ? AND budget_year = ? AND budget_month = ? AND id != ?",
                    (cat, year, month, budget_id)
                ).fetchone()
                if conflict:
                    return {
                        "success": False,
                        "error": f"A budget for '{cat}' already exists for {month:02d}/{year}."
                    }

            now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

            conn.execute(
                """
                UPDATE budgets
                SET category = ?,
                    amount_cents = ?,
                    budget_month = ?,
                    budget_year = ?,
                    month = ?,
                    year = ?,
                    notes = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (cat, amount_cents, month, year, month, year, notes, now_str, budget_id)
            )
            conn.commit()

        return {
            "success": True,
            "data": {
                "id": budget_id,
                "category": cat,
                "amount": amount_val,
                "month": month,
                "year": year,
                "notes": notes,
                "updated_at": now_str,
            }
        }

    def delete_budget(self, budget_id: int) -> Dict[str, Any]:
        """Delete a budget item by ID."""
        with get_db_connection(self.db_path) as conn:
            existing = conn.execute("SELECT id FROM budgets WHERE id = ?", (budget_id,)).fetchone()
            if not existing:
                return {"success": False, "error": f"Budget {budget_id} not found."}

            conn.execute("DELETE FROM budgets WHERE id = ?", (budget_id,))
            conn.commit()

        return {"success": True, "id": budget_id, "message": "Budget successfully deleted."}
