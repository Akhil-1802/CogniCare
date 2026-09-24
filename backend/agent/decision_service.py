"""Memory Decision and Retention Engine for CogniCare.
Applies threshold decisions, normalized confidence gating, category-specific retention,
and memory relevance decay.
"""
from datetime import datetime, timezone, timedelta, date
from typing import Optional, Tuple
from config import settings
from agent.schemas import (
    ExtractedFactCandidate,
    ScoreBreakdown,
    MemoryDecisionResult,
    MemoryDecision,
    MemoryStatus,
)


HALF_LIVES = {
    "EVENT": 7.0,
    "DAILY_ACTIVITY": 7.0,
    "APPOINTMENT": 14.0,
    "PREFERENCE": 60.0,
    "RELATIONSHIP": 60.0,
    "PERSON": 60.0,
    "IMPORTANT_FACT": 45.0,
    "MEDICINE": 30.0,
}


class MemoryDecisionService:
    """Evaluates score, confidence gate, and category retention rules to reach storage decisions."""

    @staticmethod
    def get_thresholds() -> Tuple[float, float, float]:
        return (
            settings.MEMORY_DISCARD_THRESHOLD,
            settings.MEMORY_TEMPORARY_THRESHOLD,
            settings.MEMORY_STANDARD_THRESHOLD,
        )

    @classmethod
    def evaluate_decision(
        cls,
        candidate: ExtractedFactCandidate,
        score_breakdown: ScoreBreakdown,
        reference_dt: Optional[datetime] = None,
        has_conflict: bool = False,
    ) -> MemoryDecisionResult:
        if reference_dt is None:
            reference_dt = datetime.now(timezone.utc)

        score = score_breakdown.total_score
        discard_th, temp_th, std_th = cls.get_thresholds()

        # Step 1: Base threshold decision
        if score < discard_th:
            decision: MemoryDecision = "DISCARD"
            policy = "DISCARD"
            retention_days = 0
            base_status: MemoryStatus = "REJECTED"
            reason = f"Total score ({score:.1f}) is below discard threshold ({discard_th:.1f})."
        elif score < temp_th:
            decision = "TEMPORARY_MEMORY"
            policy = "TEMPORARY_MEMORY"
            retention_days = settings.MEMORY_TEMPORARY_RETENTION_DAYS
            base_status = "ACTIVE"
            reason = f"Total score ({score:.1f}) qualifies for temporary memory ({retention_days} days)."
        elif score < std_th:
            decision = "STANDARD_MEMORY"
            policy = "STANDARD_MEMORY"
            retention_days = settings.MEMORY_STANDARD_RETENTION_DAYS
            base_status = "ACTIVE"
            reason = f"Total score ({score:.1f}) qualifies for standard memory ({retention_days} days)."
        else:
            decision = "LONG_TERM_MEMORY"
            policy = "LONG_TERM_MEMORY"
            retention_days = settings.MEMORY_LONG_TERM_RETENTION_DAYS
            base_status = "ACTIVE"
            reason = f"Total score ({score:.1f}) qualifies for long-term memory ({retention_days} days)."

        # Step 2: Normalized Confidence Gate (0.0 - 1.0)
        # Normalized confidence is evaluated directly from candidate and speech/confirmation
        normalized_conf = float(candidate.confidence)
        if candidate.requires_confirmation:
            normalized_conf = min(normalized_conf, 0.65)
        conf_gate_passed = normalized_conf >= settings.MEMORY_MIN_CONFIDENCE

        # Step 3: Category-specific retention overrides
        expires_at_dt: Optional[datetime] = None

        if decision != "DISCARD":
            # Event / Daily activity: respect event_date + grace period
            if candidate.memory_type in ("EVENT", "DAILY_ACTIVITY") and candidate.event_date:
                try:
                    ev_date = date.fromisoformat(candidate.event_date[:10])
                    # Grace period: 1 day after event
                    target_date = ev_date + timedelta(days=1)
                    expires_at_dt = datetime(
                        target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc
                    )
                    # Compute retention days from reference_dt
                    diff_days = (target_date - reference_dt.date()).days
                    retention_days = max(1, diff_days)
                    policy = "EVENT_EXPIRATION"
                    reason += f" Retention aligned with event date ({candidate.event_date}) + 1-day grace period."
                except Exception:
                    expires_at_dt = reference_dt + timedelta(days=retention_days)
            elif candidate.memory_type == "APPOINTMENT" and candidate.event_date:
                try:
                    app_date = date.fromisoformat(candidate.event_date[:10])
                    # Grace period: 2 days after appointment
                    target_date = app_date + timedelta(days=2)
                    expires_at_dt = datetime(
                        target_date.year, target_date.month, target_date.day, 23, 59, 59, tzinfo=timezone.utc
                    )
                    diff_days = (target_date - reference_dt.date()).days
                    retention_days = max(2, diff_days)
                    policy = "APPOINTMENT_EXPIRATION"
                    reason += f" Retention aligned with appointment date ({candidate.event_date}) + 2-day grace period."
                except Exception:
                    expires_at_dt = reference_dt + timedelta(days=retention_days)
            elif candidate.memory_type in ("RELATIONSHIP", "PERSON"):
                # Family relationships: up to 90 days before review/renewal
                retention_days = max(retention_days, settings.MEMORY_LONG_TERM_RETENTION_DAYS)
                policy = "RELATIONSHIP_POLICY"
                expires_at_dt = reference_dt + timedelta(days=retention_days)
            elif candidate.memory_type == "PREFERENCE":
                # Preferences: 30 to 90 days depending on score
                retention_days = settings.MEMORY_LONG_TERM_RETENTION_DAYS if score >= std_th else settings.MEMORY_STANDARD_RETENTION_DAYS
                policy = "PREFERENCE_POLICY"
                expires_at_dt = reference_dt + timedelta(days=retention_days)
            else:
                expires_at_dt = reference_dt + timedelta(days=retention_days)

        # Step 4: Status determination (confidence gate & conflict check)
        status: MemoryStatus = base_status
        requires_review = False

        if decision != "DISCARD":
            if not conf_gate_passed:
                status = "PENDING_VALIDATION"
                requires_review = True
                reason += f" Confidence ({normalized_conf:.2f}) is below minimum threshold ({settings.MEMORY_MIN_CONFIDENCE:.2f}). Marked PENDING_VALIDATION."
            elif has_conflict:
                status = "PENDING_VALIDATION"
                requires_review = True
                reason += " Potential conflict with existing memory detected. Marked PENDING_VALIDATION for caregiver review."

        expires_at_str = expires_at_dt.isoformat() if expires_at_dt else None

        return MemoryDecisionResult(
            decision=decision,
            status=status,
            retention_policy=policy,
            retention_days=retention_days,
            expires_at=expires_at_str,
            confidence_gate_passed=conf_gate_passed,
            requires_review=requires_review,
            reason=reason,
            score_breakdown=score_breakdown,
            candidate=candidate,
        )


def calculate_memory_relevance(
    total_score: float,
    last_confirmed_at: Optional[datetime],
    memory_type: str = "IMPORTANT_FACT",
    now: Optional[datetime] = None,
) -> float:
    """
    Computes time-decayed memory relevance: R(t) = S0 * 2^(-t / H)
    Where S0 = initial score, t = days elapsed, H = configurable half-life.
    Does NOT expire or delete memories; used for retrieval ranking and review priority.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    if last_confirmed_at is None:
        return total_score

    # Ensure last_confirmed_at is timezone-aware UTC
    if last_confirmed_at.tzinfo is None:
        last_confirmed_at = last_confirmed_at.replace(tzinfo=timezone.utc)

    days_elapsed = max(0.0, (now - last_confirmed_at).total_seconds() / 86400.0)
    half_life = HALF_LIVES.get(memory_type, 30.0)

    decay_factor = 2.0 ** (-days_elapsed / half_life)
    relevance = total_score * decay_factor
    return round(max(0.0, min(100.0, relevance)), 2)
