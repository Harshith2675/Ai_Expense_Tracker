import os
from app import create_app

# Production WSGI application entrypoint
app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", app.config.get("PORT", 5050)))
    debug_mode = app.config.get("DEBUG", False)
    app.run(host="0.0.0.0", port=port, debug=debug_mode)
