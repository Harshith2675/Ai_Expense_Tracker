"""
api/auto_detection.py — REST API endpoints for the Automatic Expense Detection module.
Connects provider adapters, synchronization engine, and pending transaction review queue.
"""
from flask import Blueprint, jsonify, request, current_app
from services.auto_detection_service import AutoDetectionService

auto_bp = Blueprint("auto_detection", __name__, url_prefix="/api/automatic-detection")


def _get_service() -> AutoDetectionService:
    return AutoDetectionService(current_app.config["DATABASE_PATH"])


@auto_bp.route("/status", methods=["GET"])
def get_detection_status():
    """
    GET /api/automatic-detection/status
    Returns current provider connection status, active mode, last sync timestamp,
    total detected transaction count, and pending review count.
    """
    mode_override = request.args.get("mode")
    service = _get_service()
    status = service.get_status(mode_override=mode_override)
    return jsonify(status), 200


@auto_bp.route("/sync", methods=["POST"])
def trigger_sync():
    """
    POST /api/automatic-detection/sync
    Triggers an idempotent synchronization.
    Accepts optional JSON { "mode": "demo" | "real" | "disconnected" }.
    """
    data = request.get_json(silent=True) or {}
    mode_override = data.get("mode")

    service = _get_service()
    result = service.sync(mode_override=mode_override)

    if not result.get("success"):
        return jsonify(result), 400

    return jsonify(result), 200


@auto_bp.route("/pending", methods=["GET"])
def get_pending_transactions():
    """
    GET /api/automatic-detection/pending
    Returns list of imported transactions requiring user review before entering final ledger.
    """
    service = _get_service()
    items = service.get_pending_transactions()
    return jsonify({
        "data": items,
        "count": len(items)
    }), 200


@auto_bp.route("/review/<int:tx_id>", methods=["POST"])
def review_transaction(tx_id: int):
    """
    POST /api/automatic-detection/review/<id>
    Confirm, adjust category/type, or reject a pending transaction.
    Body: { "action": "approve"|"reject", "category": str, "transaction_type": str, "notes": str }
    """
    data = request.get_json(silent=True) or {}
    action = data.get("action")

    if action not in ("approve", "reject"):
        return jsonify({"error": "action is required and must be either 'approve' or 'reject'."}), 400

    service = _get_service()
    res = service.review_transaction(
        tx_id=tx_id,
        action=action,
        category=data.get("category"),
        transaction_type=data.get("transaction_type"),
        notes=data.get("notes")
    )

    if not res.get("success"):
        return jsonify(res), 400

    return jsonify(res), 200


@auto_bp.route("/review-all", methods=["POST"])
def review_all_pending():
    """
    POST /api/automatic-detection/review-all
    Bulk approve or reject all transactions in the review queue.
    Body: { "action": "approve"|"reject" }
    """
    data = request.get_json(silent=True) or {}
    action = data.get("action")

    if action not in ("approve", "reject"):
        return jsonify({"error": "action must be 'approve' or 'reject'."}), 400

    service = _get_service()
    res = service.review_all_pending(action=action)
    return jsonify(res), 200


@auto_bp.route("/history", methods=["GET"])
def get_sync_history():
    """
    GET /api/automatic-detection/history
    Retrieve recent sync log audit entries.
    """
    limit = min(50, max(1, int(request.args.get("limit", 10))))
    service = _get_service()
    history = service.get_sync_history(limit=limit)
    return jsonify({"history": history}), 200
