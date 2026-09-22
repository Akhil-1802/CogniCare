"""Refresh-cookie helpers. Centralizes Secure/SameSite so localhost dev works
and production stays secure. Always use these instead of raw set_cookie."""
from fastapi import Response
from config.settings import COOKIE_SECURE, COOKIE_SAMESITE

REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = 7 * 24 * 60 * 60


def set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,  # type: ignore
        max_age=REFRESH_MAX_AGE,
        path="/",
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        REFRESH_COOKIE,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,  # type: ignore
    )
