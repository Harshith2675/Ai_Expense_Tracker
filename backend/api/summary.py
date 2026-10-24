"""
api/summary.py — Computed financial summary endpoint.
Reads live totals from the transactions table.
"""
from flask import Blueprint, jsonify, current_app
from database.db import get_db_connection, cents_to_dollars
from datetime import datetime

summary_bp = Blueprint("summary", __name__, url_prefix="/api")

MONTHLY_BUDGET_CENTS = 450_000  # $4,500.00 — can be made dynamic later


@summary_bp.route("/summary", methods=["GET"])
def get_summary():
    """GET /api/summary — live totals computed from the transactions table."""
    now = datetime.now()
    month_prefix = now.strftime("%Y-%m")

    with get_db_connection(current_app.config["DATABASE_PATH"]) as conn:
        # All-time totals (only approved or legacy transactions)
        row_income = conn.execute(
            "SELECT COALESCE(SUM(amount_cents), 0) AS total "
            "FROM transactions WHERE transaction_type = 'income' "
            "AND (review_status IS NULL OR review_status = 'approved')"
        ).fetchone()
        row_expense = conn.execute(
            "SELECT COALESCE(SUM(amount_cents), 0) AS total "
            "FROM transactions WHERE transaction_type = 'expense' "
            "AND (review_status IS NULL OR review_status = 'approved')"
        ).fetchone()

        # Current-month totals
        row_month_expense = conn.execute(
            "SELECT COALESCE(SUM(amount_cents), 0) AS total "
            "FROM transactions "
            "WHERE transaction_type = 'expense' AND transaction_date LIKE ? "
            "AND (review_status IS NULL OR review_status = 'approved')",
            (f"{month_prefix}%",),
        ).fetchone()

        total_count = conn.execute(
            "SELECT COUNT(*) AS cnt FROM transactions "
            "WHERE (review_status IS NULL OR review_status = 'approved')"
        ).fetchone()

        # Dynamic monthly budget: query budgets table for current month
        row_budget = conn.execute(
            "SELECT COALESCE(SUM(amount_cents), 0) AS total "
            "FROM budgets WHERE budget_month = ? AND budget_year = ?",
            (now.month, now.year)
        ).fetchone()

    total_income_cents  = row_income["total"]
    total_expense_cents = row_expense["total"]
    balance_cents       = total_income_cents - total_expense_cents
    month_expense_cents = row_month_expense["total"]

    effective_budget_cents = (
        row_budget["total"] if row_budget and row_budget["total"] > 0 else MONTHLY_BUDGET_CENTS
    )

    budget_pct = (
        round(month_expense_cents / effective_budget_cents * 1000) / 10
        if effective_budget_cents > 0 else 0.0
    )
    savings_rate = (
        round((balance_cents / total_income_cents) * 1000) / 10
        if total_income_cents > 0 else 0.0
    )

    return jsonify({
        "total_income":            cents_to_dollars(total_income_cents),
        "total_expenses":          cents_to_dollars(total_expense_cents),
        "available_balance":       cents_to_dollars(balance_cents),
        "monthly_budget":          cents_to_dollars(effective_budget_cents),
        "monthly_expenses":        cents_to_dollars(month_expense_cents),
        "budget_used_percentage":  max(0.0, budget_pct),
        "savings_rate_percentage": max(0.0, savings_rate),
        "transaction_count":       total_count["cnt"],
        "currency":                "USD",
    }), 200
