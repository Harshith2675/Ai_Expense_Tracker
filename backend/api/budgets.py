"""
api/budgets.py — REST API endpoints for Budget Management module.
Supports listing monthly budgets with dynamic spending, creating, updating,
deleting budgets, and retrieving overall budget summary & alert thresholds.
"""
from flask import Blueprint, jsonify, request, current_app
from services.budget_service import BudgetService
from datetime import datetime

budgets_bp = Blueprint("budgets", __name__, url_prefix="/api/budgets")


def _get_service() -> BudgetService:
    return BudgetService(current_app.config["DATABASE_PATH"])


def _parse_month_year():
    now = datetime.now()
    try:
        month = int(request.args.get("month", now.month))
    except (TypeError, ValueError):
        month = now.month

    try:
        year = int(request.args.get("year", now.year))
    except (TypeError, ValueError):
        year = now.year

    # Clamp to valid ranges
    if not (1 <= month <= 12):
        month = now.month
    if year < 2000 or year > 2100:
        year = now.year

    return month, year


@budgets_bp.route("", methods=["GET"])
def list_budgets():
    """
    GET /api/budgets?month=MM&year=YYYY&currency=INR|USD
    List all category budgets for the specified period along with dynamically calculated
    spending totals and threshold status indicators.
    """
    month, year = _parse_month_year()
    currency = request.args.get("currency", "USD")
    service = _get_service()
    budgets = service.get_budgets(month=month, year=year, currency=currency)

    return jsonify({
        "data": budgets,
        "count": len(budgets),
        "month": month,
        "year": year
    }), 200


@budgets_bp.route("/summary", methods=["GET"])
def get_budget_summary():
    """
    GET /api/budgets/summary?month=MM&year=YYYY&currency=INR|USD
    Get aggregate budget metrics: total budget, total spent, remaining cushion,
    usage percentage, and active warning/exceeded threshold alerts.
    """
    month, year = _parse_month_year()
    currency = request.args.get("currency", "USD")
    service = _get_service()
    summary = service.get_budget_summary(month=month, year=year, currency=currency)
    return jsonify(summary), 200


@budgets_bp.route("", methods=["POST"])
def create_budget():
    """
    POST /api/budgets
    Create a new budget.
    Body JSON: { category, amount, month?, year?, period?, notes? }
    """
    data = request.get_json(silent=True) or {}
    now = datetime.now()

    # Default month/year if omitted
    if "month" not in data or data["month"] is None:
        data["month"] = now.month
    if "year" not in data or data["year"] is None:
        data["year"] = now.year

    service = _get_service()
    res = service.create_budget(data)

    if not res.get("success"):
        return jsonify({"error": res.get("error", "Failed to create budget")}), 400

    return jsonify(res), 201


@budgets_bp.route("/<int:budget_id>", methods=["GET"])
def get_budget(budget_id: int):
    """
    GET /api/budgets/<id>
    Retrieve a single budget by ID.
    """
    service = _get_service()
    b = service.get_budget(budget_id)
    if not b:
        return jsonify({"error": f"Budget {budget_id} not found"}), 404
    return jsonify({"data": b}), 200


@budgets_bp.route("/<int:budget_id>", methods=["PUT"])
def update_budget(budget_id: int):
    """
    PUT /api/budgets/<id>
    Update an existing budget's amount, category, or notes.
    """
    data = request.get_json(silent=True) or {}
    service = _get_service()
    res = service.update_budget(budget_id, data)

    if not res.get("success"):
        status_code = 404 if "not found" in res.get("error", "").lower() else 400
        return jsonify({"error": res.get("error")}), status_code

    return jsonify(res), 200


@budgets_bp.route("/<int:budget_id>", methods=["DELETE"])
def delete_budget(budget_id: int):
    """
    DELETE /api/budgets/<id>
    Delete a budget record.
    """
    service = _get_service()
    res = service.delete_budget(budget_id)

    if not res.get("success"):
        return jsonify({"error": res.get("error")}), 404

    return jsonify(res), 200
