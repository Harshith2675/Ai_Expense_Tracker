import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Automatically load .env file if present (local development)
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(env_file)

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "expense-tracker-secret-key-default")
    DATABASE_PATH = os.getenv("DATABASE_PATH", str(BASE_DIR / "instance" / "expense_tracker.sqlite"))
    # In production, default FLASK_DEBUG to False unless explicitly set to True
    DEBUG = os.getenv("FLASK_DEBUG", "0").lower() in ("true", "1", "t")
    PORT = int(os.getenv("PORT", 5050))
    # Configurable CORS origin: single URL or comma-separated list of origins
    CORS_ALLOWED_ORIGINS = os.getenv(
        "CORS_ALLOWED_ORIGINS",
        os.getenv("FRONTEND_URL", "https://harshith2675.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:4173,http://127.0.0.1:4173")
    )
    BANKING_PROVIDER = os.getenv("BANKING_PROVIDER", "demo")

