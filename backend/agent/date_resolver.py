"""Helper for resolving relative dates (tomorrow, next Sunday, etc.)
using conversation timestamps and timezone awareness.
"""
from datetime import datetime, timezone, timedelta
import re
from typing import Optional, Tuple
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None  # fallback for environments without zoneinfo


WEEKDAYS = {
    "monday": 0, "mon": 0,
    "tuesday": 1, "tue": 1, "tues": 1,
    "wednesday": 2, "wed": 2,
    "thursday": 3, "thu": 3, "thur": 3, "thurs": 3,
    "friday": 4, "fri": 4,
    "saturday": 5, "sat": 5,
    "sunday": 6, "sun": 6,
}


def resolve_relative_date(
    expression: str,
    reference_dt: Optional[datetime] = None,
    tz_name: Optional[str] = None
) -> Tuple[Optional[str], Optional[str], bool]:
    """
    Resolves relative date expressions like 'tomorrow', 'next Sunday', 'in 2 days'.
    Returns: (resolved_date_iso_str, original_expression, requires_confirmation)
    """
    if not expression or not expression.strip():
        return None, None, False

    clean_expr = expression.strip().lower()

    # Determine reference datetime with timezone if provided
    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc)
    if tz_name and ZoneInfo:
        try:
            tz = ZoneInfo(tz_name)
            reference_dt = reference_dt.astimezone(tz)
        except Exception:
            pass

    ref_date = reference_dt.date()

    # Direct ISO date pattern YYYY-MM-DD
    iso_match = re.search(r"\b(20\d{2}-\d{2}-\d{2})\b", clean_expr)
    if iso_match:
        return iso_match.group(1), expression, False

    if "today" in clean_expr:
        return ref_date.isoformat(), expression, False

    if "tomorrow" in clean_expr:
        target = ref_date + timedelta(days=1)
        return target.isoformat(), expression, False

    if "yesterday" in clean_expr:
        target = ref_date - timedelta(days=1)
        return target.isoformat(), expression, False

    # "in X days"
    in_days_match = re.search(r"\bin\s+(\d+)\s+days?\b", clean_expr)
    if in_days_match:
        days = int(in_days_match.group(1))
        target = ref_date + timedelta(days=days)
        return target.isoformat(), expression, False

    # "next <weekday>" or "this <weekday>" or just "<weekday>"
    for name, target_weekday in WEEKDAYS.items():
        pattern = rf"\b(next|this|on)?\s*{name}\b"
        if re.search(pattern, clean_expr):
            current_weekday = ref_date.weekday()
            days_ahead = (target_weekday - current_weekday) % 7
            if "next" in clean_expr:
                if days_ahead == 0:
                    days_ahead = 7
                else:
                    days_ahead += 7
            elif days_ahead == 0:
                days_ahead = 7  # if today is Sunday and they say 'Sunday', default to next occurrence
            target = ref_date + timedelta(days=days_ahead)
            return target.isoformat(), expression, False

    # If date cannot be reliably resolved, retain original expression and flag for clarification
    return None, expression, True
