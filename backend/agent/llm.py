"""Central Mistral factory. Everything dynamic goes through here.

Set MISTRAL_API_KEY in .env. Model names, temperature and tokens are env-driven,
so no code change is needed to swap models.
"""
from config.settings import (
    MISTRAL_API_KEY,
    MISTRAL_MODEL,
    MISTRAL_EMBED_MODEL,
    MISTRAL_TEMPERATURE,
    MISTRAL_MAX_TOKENS,
    MISTRAL_TIMEOUT,
    MISTRAL_PLANNER_MODEL,
    MISTRAL_PLANNER_MAX_TOKENS,
)


def require_key() -> str:
    if not MISTRAL_API_KEY:
        raise RuntimeError(
            "MISTRAL_API_KEY is not set. Add it to backend/.env "
            "(MISTRAL_API_KEY=...) and restart the server."
        )
    return MISTRAL_API_KEY


def chat_llm():
    """Dynamic chat model. Reads model/temperature/tokens from env on every call."""
    from langchain_mistralai import ChatMistralAI

    return ChatMistralAI(
        model=MISTRAL_MODEL,
        mistral_api_key=require_key(),
        temperature=MISTRAL_TEMPERATURE,
        max_tokens=MISTRAL_MAX_TOKENS,
        timeout=MISTRAL_TIMEOUT,
    )


def planner_llm():
    """Fast tiny model for tool-routing only. Falls back to main model if unavailable."""
    from langchain_mistralai import ChatMistralAI

    try:
        return ChatMistralAI(
            model=MISTRAL_PLANNER_MODEL,
            mistral_api_key=require_key(),
            temperature=0.0,
            max_tokens=MISTRAL_PLANNER_MAX_TOKENS,
            timeout=30,
        )
    except Exception:
        return chat_llm()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Dynamic Mistral embeddings. No static vectors in production path."""
    from langchain_mistralai import MistralAIEmbeddings

    embeddings = MistralAIEmbeddings(
        model=MISTRAL_EMBED_MODEL, mistral_api_key=require_key()
    )
    return embeddings.embed_documents(texts)


def model_info() -> dict:
    return {
        "chat_model": MISTRAL_MODEL,
        "embed_model": MISTRAL_EMBED_MODEL,
        "temperature": MISTRAL_TEMPERATURE,
        "max_tokens": MISTRAL_MAX_TOKENS,
        "key_configured": bool(MISTRAL_API_KEY),
    }


def is_rate_limit_error(e: Exception) -> bool:
    s = f"{type(e).__name__}: {e}"
    return "429" in s or "rate_limited" in s.lower() or "rate limit" in s.lower()


def invoke_with_retry(invoke_fn, max_retries: int = 2):
    """Retry Mistral calls on 429 with exponential backoff.
    invoke_fn: zero-arg callable returning the LLM response.
    Raises the last exception if all retries are rate-limited."""
    import time

    last: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return invoke_fn()
        except Exception as e:
            last = e
            if not is_rate_limit_error(e) or attempt >= max_retries:
                raise
            wait = 2 ** (attempt + 1)
            try:
                # Respect server's Retry-After header when present
                resp = getattr(e, "response", None)
                ra = None
                if resp is not None:
                    ra = resp.headers.get("retry-after") if hasattr(resp, "headers") else None
                if ra:
                    wait = min(int(float(ra)) + 1, 30)
            except Exception:
                pass
            time.sleep(wait)
    if last is not None:
        raise last
    raise RuntimeError("Mistral call failed")
