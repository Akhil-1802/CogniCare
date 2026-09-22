import os
from dotenv import load_dotenv
load_dotenv()

SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")

# Cookies: Secure cookies are never sent over http://localhost, which breaks
# refresh on local dev. Default to non-secure locally, secure in production.
APP_ENV = os.getenv("APP_ENV", "development")
_cookie_secure_env = os.getenv("COOKIE_SECURE")
if _cookie_secure_env is not None:
    COOKIE_SECURE = _cookie_secure_env.lower() == "true"
else:
    COOKIE_SECURE = APP_ENV == "production"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")

# ---- CogniCare AI Assistant (fully dynamic via Mistral) ----
CHAT_RETENTION_DAYS = int(os.getenv("CHAT_RETENTION_DAYS", "30"))
CHAT_CLEANUP_ENABLED = os.getenv("CHAT_CLEANUP_ENABLED", "false").lower() == "true"

# Single API key drives chat, tool routing, extraction, summaries and embeddings.
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
MISTRAL_MODEL = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
MISTRAL_EMBED_MODEL = os.getenv("MISTRAL_EMBED_MODEL", "mistral-embed")
MISTRAL_TEMPERATURE = float(os.getenv("MISTRAL_TEMPERATURE", "0.2"))
MISTRAL_MAX_TOKENS = int(os.getenv("MISTRAL_MAX_TOKENS", "800"))
MISTRAL_TIMEOUT = int(os.getenv("MISTRAL_TIMEOUT", "60"))
# Fast tiny model just for tool-routing (planner). Override if unavailable.
MISTRAL_PLANNER_MODEL = os.getenv("MISTRAL_PLANNER_MODEL", "ministral-3b-latest")
MISTRAL_PLANNER_MAX_TOKENS = int(os.getenv("MISTRAL_PLANNER_MAX_TOKENS", "200"))

CHROMA_DIR = os.getenv("CHROMA_DIR", "./chroma_data")

DISCLAIMER = (
    "CogniCare is an assistive information and memory support system. "
    "It does not provide medical diagnosis, treatment, or professional medical advice."
)