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

# ---- CogniCare Scoring-Based Memory System Configuration ----
MEMORY_IMPORTANCE_WEIGHT = float(os.getenv("MEMORY_IMPORTANCE_WEIGHT", "0.30"))
MEMORY_CONFIDENCE_WEIGHT = float(os.getenv("MEMORY_CONFIDENCE_WEIGHT", "0.25"))
MEMORY_USEFULNESS_WEIGHT = float(os.getenv("MEMORY_USEFULNESS_WEIGHT", "0.20"))
MEMORY_PERSISTENCE_WEIGHT = float(os.getenv("MEMORY_PERSISTENCE_WEIGHT", "0.15"))
MEMORY_NOVELTY_WEIGHT = float(os.getenv("MEMORY_NOVELTY_WEIGHT", "0.10"))

MEMORY_DISCARD_THRESHOLD = float(os.getenv("MEMORY_DISCARD_THRESHOLD", "40.0"))
MEMORY_TEMPORARY_THRESHOLD = float(os.getenv("MEMORY_TEMPORARY_THRESHOLD", "60.0"))
MEMORY_STANDARD_THRESHOLD = float(os.getenv("MEMORY_STANDARD_THRESHOLD", "80.0"))

MEMORY_MIN_CONFIDENCE = float(os.getenv("MEMORY_MIN_CONFIDENCE", "0.70"))

MEMORY_TEMPORARY_RETENTION_DAYS = int(os.getenv("MEMORY_TEMPORARY_RETENTION_DAYS", "7"))
MEMORY_STANDARD_RETENTION_DAYS = int(os.getenv("MEMORY_STANDARD_RETENTION_DAYS", "30"))
MEMORY_LONG_TERM_RETENTION_DAYS = int(os.getenv("MEMORY_LONG_TERM_RETENTION_DAYS", "90"))

MEMORY_CLEANUP_ENABLED = os.getenv("MEMORY_CLEANUP_ENABLED", "false").lower() == "true"


def validate_memory_config():
    """Validate that weights sum to 1.0, thresholds are ordered, and retention is positive."""
    weights = [
        MEMORY_IMPORTANCE_WEIGHT,
        MEMORY_CONFIDENCE_WEIGHT,
        MEMORY_USEFULNESS_WEIGHT,
        MEMORY_PERSISTENCE_WEIGHT,
        MEMORY_NOVELTY_WEIGHT,
    ]
    if any(w < 0 for w in weights):
        raise ValueError("Memory scoring weights must be non-negative.")
    if abs(sum(weights) - 1.0) > 1e-4:
        raise ValueError(f"Memory scoring weights must sum to 1.0 (got {sum(weights):.4f})")
    if not (0 <= MEMORY_DISCARD_THRESHOLD <= MEMORY_TEMPORARY_THRESHOLD <= MEMORY_STANDARD_THRESHOLD <= 100):
        raise ValueError("Memory thresholds must satisfy: 0 <= discard <= temporary <= standard <= 100")
    if MEMORY_TEMPORARY_RETENTION_DAYS <= 0 or MEMORY_STANDARD_RETENTION_DAYS <= 0 or MEMORY_LONG_TERM_RETENTION_DAYS <= 0:
        raise ValueError("Memory retention days must be positive integers.")
    if not (0.0 <= MEMORY_MIN_CONFIDENCE <= 1.0):
        raise ValueError("MEMORY_MIN_CONFIDENCE must be between 0.0 and 1.0.")
    return True


DISCLAIMER = (
    "CogniCare is an assistive information and memory support system. "
    "It does not provide medical diagnosis, treatment, or professional medical advice."
)