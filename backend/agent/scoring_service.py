"""Weighted Memory Scoring Engine for CogniCare.
Calculates a 0-100 score based on 5 weighted factors:
1. Importance (30%)
2. Confidence (25%)
3. Future Usefulness (20%)
4. Persistence (15%)
5. Novelty (10%)
"""
from typing import Optional, Dict, Any
from config import settings
from agent.schemas import ExtractedFactCandidate, ScoreBreakdown


# Default factor estimates by memory type when not explicitly estimated
TYPE_DEFAULTS = {
    "RELATIONSHIP": {"importance": 90.0, "usefulness": 95.0, "persistence": 95.0},
    "PERSON": {"importance": 85.0, "usefulness": 90.0, "persistence": 90.0},
    "IMPORTANT_FACT": {"importance": 80.0, "usefulness": 80.0, "persistence": 75.0},
    "MEDICINE": {"importance": 90.0, "usefulness": 90.0, "persistence": 50.0},
    "APPOINTMENT": {"importance": 85.0, "usefulness": 85.0, "persistence": 30.0},
    "PREFERENCE": {"importance": 75.0, "usefulness": 85.0, "persistence": 80.0},
    "EVENT": {"importance": 75.0, "usefulness": 80.0, "persistence": 25.0},
    "DAILY_ACTIVITY": {"importance": 60.0, "usefulness": 65.0, "persistence": 25.0},
}


class MemoryScoringService:
    """Computes a multi-factor score (0-100) for a memory candidate."""

    @staticmethod
    def get_weights() -> Dict[str, float]:
        return {
            "importance": settings.MEMORY_IMPORTANCE_WEIGHT,
            "confidence": settings.MEMORY_CONFIDENCE_WEIGHT,
            "usefulness": settings.MEMORY_USEFULNESS_WEIGHT,
            "persistence": settings.MEMORY_PERSISTENCE_WEIGHT,
            "novelty": settings.MEMORY_NOVELTY_WEIGHT,
        }

    @classmethod
    def calculate_score(
        cls,
        candidate: ExtractedFactCandidate,
        novelty_score: float = 100.0,
        speech_confidence: float = 1.0,
    ) -> ScoreBreakdown:
        """
        Calculates individual factor scores and weighted total score.
        All individual factors and the total score are clamped between 0 and 100.
        """
        defaults = TYPE_DEFAULTS.get(candidate.memory_type, {"importance": 70.0, "usefulness": 70.0, "persistence": 50.0})

        # 1. Importance (30%)
        raw_imp = candidate.importance_estimate if candidate.importance_estimate is not None else defaults["importance"]
        importance = max(0.0, min(100.0, float(raw_imp)))

        # 2. Confidence (25%)
        # Convert 0-1 scale to 0-100, adjusting for speech confidence and ambiguity flags
        base_conf = float(candidate.confidence) * 100.0
        if speech_confidence < 1.0:
            base_conf = base_conf * speech_confidence
        if candidate.requires_confirmation:
            base_conf = min(base_conf, 65.0)
        confidence = max(0.0, min(100.0, base_conf))

        # 3. Future Usefulness (20%)
        raw_use = candidate.usefulness_estimate if candidate.usefulness_estimate is not None else defaults["usefulness"]
        usefulness = max(0.0, min(100.0, float(raw_use)))

        # 4. Persistence (15%)
        raw_pers = candidate.persistence_estimate if candidate.persistence_estimate is not None else defaults["persistence"]
        persistence = max(0.0, min(100.0, float(raw_pers)))

        # 5. Novelty (10%)
        novelty = max(0.0, min(100.0, float(novelty_score)))

        weights = cls.get_weights()
        total_score = (
            (importance * weights["importance"]) +
            (confidence * weights["confidence"]) +
            (usefulness * weights["usefulness"]) +
            (persistence * weights["persistence"]) +
            (novelty * weights["novelty"])
        )
        total_score = round(max(0.0, min(100.0, total_score)), 2)

        return ScoreBreakdown(
            importance=round(importance, 2),
            confidence=round(confidence, 2),
            usefulness=round(usefulness, 2),
            persistence=round(persistence, 2),
            novelty=round(novelty, 2),
            total_score=total_score,
            weights=weights,
        )

    @classmethod
    def calculate_custom_score(
        cls,
        importance: float,
        confidence: float,
        usefulness: float,
        persistence: float,
        novelty: float,
        weights_override: Optional[Dict[str, float]] = None,
    ) -> ScoreBreakdown:
        """Helper for unit tests and direct scoring simulation."""
        imp = max(0.0, min(100.0, float(importance)))
        conf = max(0.0, min(100.0, float(confidence)))
        use = max(0.0, min(100.0, float(usefulness)))
        pers = max(0.0, min(100.0, float(persistence)))
        nov = max(0.0, min(100.0, float(novelty)))

        weights = weights_override or cls.get_weights()
        total = (
            (imp * weights["importance"]) +
            (conf * weights["confidence"]) +
            (use * weights["usefulness"]) +
            (pers * weights["persistence"]) +
            (nov * weights["novelty"])
        )
        total = round(max(0.0, min(100.0, total)), 2)

        return ScoreBreakdown(
            importance=round(imp, 2),
            confidence=round(conf, 2),
            usefulness=round(use, 2),
            persistence=round(pers, 2),
            novelty=round(nov, 2),
            total_score=total,
            weights=weights,
        )
