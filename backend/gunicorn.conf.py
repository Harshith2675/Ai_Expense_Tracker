import os

# Render sets PORT dynamically. Bind to 0.0.0.0:$PORT
port = os.environ.get("PORT", "5050")
bind = f"0.0.0.0:{port}"

# Concurrency settings optimized for Render Free / Starter instances
workers = int(os.environ.get("WEB_CONCURRENCY", "2"))
threads = 2
timeout = 120

# Structured stdout logging
accesslog = "-"
errorlog = "-"
loglevel = "info"
