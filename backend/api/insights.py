"""
api/insights.py — Flask Blueprint for AI Insights module.
Exposes endpoints for spending summary, category breakdowns, trends,
potentially unusual transactions (anomalies), and grounded saving recommendations.
"""
from datetime import date
from flask import Blueprint, jsonify, request, current_app
from services.insights_service import InsightsService

insights_bp = Blueprint("insights_bp", __name__, url_prefix="/api/insights")


def _get_service() -> InsightsService:
    db_path = current_app.config.get("DATABASE_PATH")
    return InsightsService(db_path)


def _parse_month_year():
    today = date.today()
    raw_month = request.args.get("month")
    raw_year = request.args.get("year")

    try:
        month = int(raw_month) if raw_month is not None and raw_month != "" else today.month
        year = int(raw_year) if raw_year is not None and raw_year != "" else today.year
    except (ValueError, TypeError):
        return None, None, "Month and year must be valid integers."

    if not (1 <= month <= 12):
        return None, None, "Month must be between 1 and 12."
    if not (2000 <= year <= 2100):
        return None, None, "Year must be between 2000 and 2100."

    return month, year, None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@insights_bp.route("/summary", methods=["GET"])
def get_insights_summary():
    """
    GET /api/insights/summary?month=MM&year=YYYY&currency=INR|USD
    Returns financial summary with MoM comparisons, daily average, top category, and budget health.
    """
    month, year, err = _parse_month_year()
    if err:
        return jsonify({"error": err}), 400

    currency = request.args.get("currency", "USD")

    try:
        service = _get_service()
        data = service.get_summary(month, year, currency=currency)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        current_app.logger.error(f"Error computing insights summary: {e}")
        return jsonify({"error": f"Failed to calculate insights summary: {str(e)}"}), 500


@insights_bp.route("/categories", methods=["GET"])
def get_insights_categories():
    """
    GET /api/insights/categories?month=MM&year=YYYY
    Returns category spending totals, percentages, and MoM changes.
    """
    month, year, err = _parse_month_year()
    if err:
        return jsonify({"error": err}), 400

    try:
        service = _get_service()
        data = service.get_categories(month, year)
        return jsonify({"success": True, "data": data, "count": len(data)})
    except Exception as e:
        current_app.logger.error(f"Error computing insights categories: {e}")
        return jsonify({"error": f"Failed to calculate category insights: {str(e)}"}), 500


@insights_bp.route("/trends", methods=["GET"])
def get_insights_trends():
    """
    GET /api/insights/trends?months=6&end_month=MM&end_year=YYYY
    Returns rolling multi-month trends, income vs expense, and persistent growth categories.
    """
    months_param = request.args.get("months", "6")
    try:
        months_count = int(months_param)
    except (ValueError, TypeError):
        months_count = 6

    month, year, _ = _parse_month_year()

    try:
        service = _get_service()
        data = service.get_trends(months=months_count, end_month=month, end_year=year)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        current_app.logger.error(f"Error computing insights trends: {e}")
        return jsonify({"error": f"Failed to calculate spending trends: {str(e)}"}), 500


@insights_bp.route("/anomalies", methods=["GET"])
def get_insights_anomalies():
    """
    GET /api/insights/anomalies?month=MM&year=YYYY&currency=INR|USD
    Returns potentially unusual transactions flagged via transparent statistical baselines.
    """
    month, year, err = _parse_month_year()
    if err:
        return jsonify({"error": err}), 400

    currency = request.args.get("currency", "USD")

    try:
        service = _get_service()
        data = service.get_anomalies(month, year, currency=currency)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        current_app.logger.error(f"Error computing anomalies: {e}")
        return jsonify({"error": f"Failed to compute transaction anomalies: {str(e)}"}), 500


@insights_bp.route("/anomalies/<int:tx_id>/dismiss", methods=["POST"])
def dismiss_insights_anomaly(tx_id: int):
    """
    POST /api/insights/anomalies/<tx_id>/dismiss
    Dismisses a flagged potentially unusual transaction alert.
    """
    try:
        service = _get_service()
        res = service.dismiss_anomaly(tx_id)
        return jsonify(res)
    except Exception as e:
        current_app.logger.error(f"Error dismissing anomaly {tx_id}: {e}")
        return jsonify({"error": f"Failed to dismiss alert: {str(e)}"}), 500


@insights_bp.route("/recommendations", methods=["GET"])
def get_insights_recommendations():
    """
    GET /api/insights/recommendations?month=MM&year=YYYY&currency=INR|USD
    Returns grounded, personalized saving recommendations calculated from actual data.
    """
    month, year, err = _parse_month_year()
    if err:
        return jsonify({"error": err}), 400

    currency = request.args.get("currency", "USD")

    try:
        service = _get_service()
        data = service.get_recommendations(month, year, currency=currency)
        return jsonify({"success": True, "data": data})
    except Exception as e:
        current_app.logger.error(f"Error generating recommendations: {e}")
        return jsonify({"error": f"Failed to generate recommendations: {str(e)}"}), 500


@insights_bp.route("/recurring", methods=["GET"])
def get_recurring_expenses():
    """
    GET /api/insights/recurring
    Returns detected candidates for recurring monthly subscriptions and bills.
    """
    try:
        service = _get_service()
        data = service.get_recurring_candidates()
        return jsonify({"success": True, "data": data, "count": len(data)})
    except Exception as e:
        current_app.logger.error(f"Error detecting recurring expenses: {e}")
        return jsonify({"error": f"Failed to detect recurring expenses: {str(e)}"}), 500
