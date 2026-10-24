"""
api/routes.py — Legacy/utility routes kept for compatibility.
New CRUD endpoints live in api/transactions.py and api/summary.py.
"""
from flask import Blueprint, jsonify, request, current_app
from ml.predictor import ExpenseAIAnalytics
from database.db import get_db_connection

api_bp = Blueprint("api", __name__, url_prefix="/api")
ai_service = ExpenseAIAnalytics()


@api_bp.route("/health", methods=["GET"])
def health_check():
    db_file = current_app.config.get("DATABASE_PATH")
    db_status = "unavailable"
    if db_file:
        try:
            with get_db_connection(db_file) as conn:
                conn.execute("SELECT 1")
            db_status = "sqlite_ready"
        except Exception:
            db_status = "error"

    return jsonify({
        "status": "healthy" if db_status == "sqlite_ready" else "degraded",
        "service": "AI Expense Tracker API",
        "version": "2.0.0",
        "database": db_status,
        "ai_module": "scaffolded"
    }), 200



@api_bp.route("/categories", methods=["GET"])
def get_categories():
    """Return the canonical category / income-source lists."""
    return jsonify({
        "expense_categories": [
            "Food", "Groceries", "Transportation", "Shopping",
            "Education", "Healthcare", "Entertainment", "Bills",
            "Rent", "Travel", "Other"
        ],
        "income_sources": [
            "Salary", "Freelance", "Business", "Investment", "Gift", "Other"
        ],
        "payment_methods": [
            "Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer", "Other"
        ]
    }), 200


@api_bp.route("/ai/predict-category", methods=["POST"])
def predict_category():
    data = request.get_json(silent=True) or {}
    description = data.get("description", "")
    if not description:
        return jsonify({"error": "description is required"}), 400
    prediction = ai_service.predict_category(description)
    return jsonify(prediction), 200
