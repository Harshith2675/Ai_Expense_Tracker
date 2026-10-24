import os
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from api.routes import api_bp
from api.transactions import txn_bp
from api.summary import summary_bp
from api.auto_detection import auto_bp
from api.budgets import budgets_bp
from api.insights import insights_bp
from database.db import init_db


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure CORS using environment variable or sensible localhost defaults
    cors_origins_raw = app.config.get("CORS_ALLOWED_ORIGINS", "")
    if isinstance(cors_origins_raw, str) and cors_origins_raw.strip() == "*":
        allowed_origins = "*"
    elif isinstance(cors_origins_raw, str):
        allowed_origins = [orig.strip() for orig in cors_origins_raw.split(",") if orig.strip()]
        if not allowed_origins:
            allowed_origins = [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
                "http://localhost:4173",
                "http://127.0.0.1:4173",
            ]
    else:
        allowed_origins = cors_origins_raw

    CORS(
        app,
        resources={r"/*": {"origins": allowed_origins}},
        supports_credentials=True,
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    # Register all blueprints
    app.register_blueprint(api_bp)
    app.register_blueprint(txn_bp)
    app.register_blueprint(summary_bp)
    app.register_blueprint(auto_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(insights_bp)

    # Initialise or migrate SQLite on startup
    db_file = app.config.get("DATABASE_PATH")
    if db_file:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(db_file)), exist_ok=True)
            if not os.path.exists(db_file):
                init_db(db_file)
            else:
                from database.db import get_db_connection, migrate_db
                with get_db_connection(db_file) as conn:
                    migrate_db(conn)
        except Exception as e:
            app.logger.warning(f"Could not initialise/migrate DB automatically: {e}")

    @app.route("/health", methods=["GET"])
    def root_health():
        return jsonify({
            "status": "healthy",
            "service": "AI Expense Tracker API",
            "version": "2.0.0"
        }), 200

    @app.route("/")
    def index():
        return jsonify({
            "message": "AI Expense Tracker Backend API v2",
            "documentation": "/api/health",
            "endpoints": [
                "GET  /api/health",
                "GET  /api/summary",
                "GET  /api/categories",
                "GET  /api/transactions",
                "POST /api/transactions",
                "GET  /api/transactions/<id>",
                "PUT  /api/transactions/<id>",
                "DELETE /api/transactions/<id>",
                "GET  /api/budgets",
                "POST /api/budgets",
                "GET  /api/budgets/<id>",
                "PUT  /api/budgets/<id>",
                "DELETE /api/budgets/<id>",
                "GET  /api/budgets/summary",
                "GET  /api/insights/summary",
                "GET  /api/insights/categories",
                "GET  /api/insights/trends",
                "GET  /api/insights/anomalies",
                "POST /api/insights/anomalies/<id>/dismiss",
                "GET  /api/insights/recommendations",
                "GET  /api/insights/recurring",
                "GET  /api/automatic-detection/status",
                "POST /api/automatic-detection/sync",
                "GET  /api/automatic-detection/pending",
                "POST /api/automatic-detection/review/<id>",
                "POST /api/automatic-detection/review-all",
                "GET  /api/automatic-detection/history",
                "POST /api/ai/predict-category",
            ]
        })

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Endpoint not found"}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({"error": "Internal server error"}), 500

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", app.config.get("PORT", 5050)))
    debug_mode = app.config.get("DEBUG", False)
    print(f"Starting AI Expense Tracker API server on http://localhost:{port} (debug={debug_mode})")
    app.run(host="0.0.0.0", port=port, debug=debug_mode)

