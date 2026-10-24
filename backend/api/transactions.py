"""
api/transactions.py — Full CRUD REST endpoints for transactions.
All monetary values are stored as integer cents internally;
the API accepts and returns decimal dollar strings for easy JS consumption.
"""
from flask import Blueprint, jsonify, request, current_app
from database.db import get_db_connection, dollars_to_cents, cents_to_dollars, row_to_dict
import sqlite3
from datetime import datetime, timezone

txn_bp = Blueprint("transactions", __name__, url_prefix="/api/transactions")

# ──────────────────────────────────────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────────────────────────────────────

EXPENSE_CATEGORIES = [
    "Food", "Groceries", "Transportation", "Shopping",
    "Education", "Healthcare", "Entertainment", "Bills",
    "Rent", "Travel", "Other"
]
INCOME_SOURCES = [
    "Salary", "Freelance", "Business", "Investment", "Gift", "Other"
]
PAYMENT_METHODS = [
    "Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer", "Other"
]
ALL_CATEGORIES = EXPENSE_CATEGORIES + INCOME_SOURCES


def _db_path():
    return current_app.config["DATABASE_PATH"]


def _tx_to_api(row: dict) -> dict:
    """Convert a DB row dict to the API response shape."""
    return {
        "id": row["id"],
        "transaction_type": row["transaction_type"],
        "category": row["category"],
        "description": row["description"],
        "payment_method": row["payment_method"],
        "amount": cents_to_dollars(row["amount_cents"]),
        "transaction_date": row["transaction_date"],
        "notes": row.get("notes") or "",
        "detection_method": row["detection_method"],
        "review_status": row.get("review_status") or "approved",
        "external_id": row.get("external_id"),
        "provider": row.get("provider"),
        "sync_timestamp": row.get("sync_timestamp"),
        "is_demo": bool(row.get("is_demo")),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def _validate_transaction_payload(data: dict, is_update: bool = False) -> list[str]:
    """Returns a list of validation error messages (empty = valid)."""
    errors = []

    # Amount
    raw_amount = data.get("amount")
    if raw_amount is None and not is_update:
        errors.append("amount is required.")
    elif raw_amount is not None:
        try:
            amt = float(raw_amount)
            if amt <= 0:
                errors.append("amount must be greater than zero.")
        except (ValueError, TypeError):
            errors.append("amount must be a valid number.")

    # Transaction date
    raw_date = data.get("transaction_date")
    if raw_date is None and not is_update:
        errors.append("transaction_date is required (YYYY-MM-DD).")
    elif raw_date is not None:
        try:
            datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError:
            errors.append("transaction_date must be in YYYY-MM-DD format.")

    # Transaction type
    tx_type = data.get("transaction_type")
    if tx_type is None and not is_update:
        errors.append("transaction_type is required ('expense' or 'income').")
    elif tx_type is not None and tx_type not in ("expense", "income"):
        errors.append("transaction_type must be 'expense' or 'income'.")

    # Category
    category = data.get("category")
    if category is None and not is_update:
        errors.append("category is required.")
    elif category is not None and category not in ALL_CATEGORIES:
        errors.append(
            f"category '{category}' is not valid. "
            f"Choose from: {', '.join(ALL_CATEGORIES)}"
        )

    # Description
    desc = data.get("description", "").strip() if data.get("description") else None
    if desc is None and not is_update:
        errors.append("description is required.")
    elif desc == "":
        errors.append("description cannot be blank.")

    # Payment method (optional, defaults to 'Other')
    pm = data.get("payment_method")
    if pm is not None and pm not in PAYMENT_METHODS:
        errors.append(
            f"payment_method '{pm}' is not valid. "
            f"Choose from: {', '.join(PAYMENT_METHODS)}"
        )

    return errors


# ──────────────────────────────────────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────────────────────────────────────

@txn_bp.route("", methods=["GET"])
def list_transactions():
    """GET /api/transactions — paginated, filtered, sorted list.

    Query params:
      page            int   (default 1)
      limit           int   (default 25, max 200)
      q               str   full-text search on description
      type            str   'income' | 'expense'
      category        str   exact category name
      payment_method  str   exact payment method
      detection       str   'manual' | 'automatic'
      date_from       str   YYYY-MM-DD
      date_to         str   YYYY-MM-DD
      sort            str   'newest'(default) | 'oldest' | 'amount_desc' | 'amount_asc'
    """
    # ── Pagination ──────────────────────────────────────────────────────────
    try:
        page  = max(1, int(request.args.get("page", 1)))
        limit = min(200, max(1, int(request.args.get("limit", 25))))
    except (ValueError, TypeError):
        page, limit = 1, 25
    offset = (page - 1) * limit

    # ── Filters (all validated, parameterised) ────────────────────────────
    where_clauses: list[str] = []
    params: list = []

    tx_type = request.args.get("type", "").strip()
    if tx_type in ("income", "expense"):
        where_clauses.append("transaction_type = ?")
        params.append(tx_type)

    category = request.args.get("category", "").strip()
    if category and category in ALL_CATEGORIES:
        where_clauses.append("category = ?")
        params.append(category)

    payment_method = request.args.get("payment_method", "").strip()
    if payment_method and payment_method in PAYMENT_METHODS:
        where_clauses.append("payment_method = ?")
        params.append(payment_method)

    detection = request.args.get("detection", "").strip()
    if detection in ("manual", "automatic"):
        where_clauses.append("detection_method = ?")
        params.append(detection)

    review_status = request.args.get("review_status", "").strip()
    if review_status in ("approved", "pending_review", "rejected"):
        where_clauses.append("review_status = ?")
        params.append(review_status)
    elif review_status == "all":
        pass
    else:
        # Default: only show approved in general transaction list
        where_clauses.append("(review_status IS NULL OR review_status = 'approved')")

    date_from = request.args.get("date_from", "").strip()
    if date_from:
        try:
            datetime.strptime(date_from, "%Y-%m-%d")
            where_clauses.append("transaction_date >= ?")
            params.append(date_from)
        except ValueError:
            pass  # ignore malformed dates

    date_to = request.args.get("date_to", "").strip()
    if date_to:
        try:
            datetime.strptime(date_to, "%Y-%m-%d")
            where_clauses.append("transaction_date <= ?")
            params.append(date_to)
        except ValueError:
            pass

    q = request.args.get("q", "").strip()
    if q:
        where_clauses.append("(description LIKE ? OR notes LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like])

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    # ── Sort ─────────────────────────────────────────────────────────────
    SORT_MAP = {
        "newest":      "transaction_date DESC, id DESC",
        "oldest":      "transaction_date ASC, id ASC",
        "amount_desc": "amount_cents DESC",
        "amount_asc":  "amount_cents ASC",
    }
    sort_key = request.args.get("sort", "newest").strip()
    order_sql = SORT_MAP.get(sort_key, SORT_MAP["newest"])

    # ── Query ─────────────────────────────────────────────────────────────
    with get_db_connection(_db_path()) as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM transactions {where_sql}", params
        ).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM transactions {where_sql} "
            f"ORDER BY {order_sql} LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()

    pages = max(1, -(-total // limit))  # ceiling division

    return jsonify({
        "data": [_tx_to_api(row_to_dict(r)) for r in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "pages": pages,
        }
    }), 200


@txn_bp.route("", methods=["POST"])
def create_transaction():
    """POST /api/transactions — create a new manual transaction."""
    data = request.get_json(silent=True) or {}

    errors = _validate_transaction_payload(data)
    if errors:
        return jsonify({"errors": errors}), 400

    amount_cents = dollars_to_cents(data["amount"])
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_db_connection(_db_path()) as conn:
        cur = conn.execute(
            """
            INSERT INTO transactions
              (transaction_type, category, description, payment_method,
               amount_cents, transaction_date, notes, detection_method,
               created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
            """,
            (
                data["transaction_type"],
                data["category"],
                data["description"].strip(),
                data.get("payment_method", "Other"),
                amount_cents,
                data["transaction_date"],
                (data.get("notes") or "").strip() or None,
                now, now,
            ),
        )
        conn.commit()
        new_id = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (new_id,)
        ).fetchone()

    return jsonify(_tx_to_api(row_to_dict(row))), 201


@txn_bp.route("/<int:tx_id>", methods=["GET"])
def get_transaction(tx_id: int):
    """GET /api/transactions/<id> — retrieve a single transaction."""
    with get_db_connection(_db_path()) as conn:
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()

    if row is None:
        return jsonify({"error": f"Transaction {tx_id} not found."}), 404

    return jsonify(_tx_to_api(row_to_dict(row))), 200


@txn_bp.route("/<int:tx_id>", methods=["PUT"])
def update_transaction(tx_id: int):
    """PUT /api/transactions/<id> — full or partial update."""
    data = request.get_json(silent=True) or {}

    with get_db_connection(_db_path()) as conn:
        existing = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()

    if existing is None:
        return jsonify({"error": f"Transaction {tx_id} not found."}), 404

    errors = _validate_transaction_payload(data, is_update=True)
    if errors:
        return jsonify({"errors": errors}), 400

    existing_dict = row_to_dict(existing)

    # Merge: only fields supplied in the body override existing values
    tx_type      = data.get("transaction_type", existing_dict["transaction_type"])
    category     = data.get("category", existing_dict["category"])
    description  = (data.get("description") or existing_dict["description"]).strip()
    payment_meth = data.get("payment_method", existing_dict["payment_method"])
    amount_cents = (
        dollars_to_cents(data["amount"])
        if "amount" in data
        else existing_dict["amount_cents"]
    )
    tx_date      = data.get("transaction_date", existing_dict["transaction_date"])
    notes        = (data.get("notes") or existing_dict.get("notes") or "").strip() or None
    now          = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    with get_db_connection(_db_path()) as conn:
        conn.execute(
            """
            UPDATE transactions
               SET transaction_type = ?, category = ?, description = ?,
                   payment_method = ?, amount_cents = ?, transaction_date = ?,
                   notes = ?, updated_at = ?
             WHERE id = ?
            """,
            (tx_type, category, description, payment_meth,
             amount_cents, tx_date, notes, now, tx_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()

    return jsonify(_tx_to_api(row_to_dict(row))), 200


@txn_bp.route("/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id: int):
    """DELETE /api/transactions/<id>."""
    with get_db_connection(_db_path()) as conn:
        existing = conn.execute(
            "SELECT id FROM transactions WHERE id = ?", (tx_id,)
        ).fetchone()
        if existing is None:
            return jsonify({"error": f"Transaction {tx_id} not found."}), 404
        conn.execute("DELETE FROM transactions WHERE id = ?", (tx_id,))
        conn.commit()

    return jsonify({"message": f"Transaction {tx_id} deleted successfully."}), 200
