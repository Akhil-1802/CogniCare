"""Memory extraction service for CogniCare.
Extracts individual structured facts from patient messages and conversation context.
Supports single and multiple fact extraction per message with Pydantic validation.
"""
import json
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from agent.schemas import (
    ExtractedFactCandidate,
    MultiCandidateExtractionResult,
    validate_candidate,
    validate_extraction_payload,
)
from agent.date_resolver import resolve_relative_date


MULTI_EXTRACTION_PROMPT = """You extract long-term memory candidates for an elderly-care cognitive assistant.
A single patient message may contain multiple distinct facts (for example, a family visit AND a daily preference).
Do not store the whole message as a single memory. Extract individual structured facts into candidates.

Patient message: {patient}
Assistant reply: {assistant}
Reference Date: {ref_date}

Return ONLY valid JSON matching this schema:
{{
  "candidates": [
    {{
      "title": "short descriptive title (e.g., 'Emily\\'s visit', 'Evening walk preference')",
      "content": "clear factual statement (1-2 sentences)",
      "memory_type": "PERSON" | "RELATIONSHIP" | "EVENT" | "APPOINTMENT" | "MEDICINE" | "PREFERENCE" | "IMPORTANT_FACT" | "DAILY_ACTIVITY",
      "entities": ["entity1", "entity2"],
      "relative_date_text": "relative expression if mentioned, e.g. 'next Sunday' or null",
      "confidence": 0.0 to 1.0,
      "requires_confirmation": true | false,
      "importance_estimate": 0 to 100,
      "usefulness_estimate": 0 to 100,
      "persistence_estimate": 0 to 100
    }}
  ]
}}

Rules:
- For greetings, casual chat, small talk ("hello", "thanks", "how are you"): return {{"candidates": []}}.
- Never invent facts, names, or dates not in the message.
- If a statement is uncertain ("maybe", "i think", "someone said"), lower confidence and set requires_confirmation=true.
- Compound messages with multiple facts MUST produce multiple independent candidates.
JSON:"""


def _offline_extract_candidates(
    patient: str,
    assistant: str = "",
    reference_dt: Optional[datetime] = None,
    tz_name: Optional[str] = None,
    speech_confidence: float = 1.0,
) -> List[ExtractedFactCandidate]:
    """Offline rule-based parser for offline unit tests and dev environments without an API key."""
    t = (patient or "").strip()
    if len(t) < 8:
        return []

    t_lower = t.lower()
    # Greetings and casual small talk
    if any(g in t_lower for g in ("hello", "hi ", "thanks", "thank you", "bye", "good morning", "how are you")) and len(t) < 40:
        return []

    candidates: List[ExtractedFactCandidate] = []

    # Check if patient expressed hesitation/uncertainty
    ambiguous = any(w in t_lower for w in ("maybe", "perhaps", "i think", "not sure", "possibly", "i guess"))
    base_conf = 0.60 if ambiguous else min(0.92, max(0.1, speech_confidence * 0.95))
    requires_conf = ambiguous or (speech_confidence < 0.70)

    # 1. Family / Relationship / Person
    # E.g. "My daughter Emily is visiting me next Sunday" or "Emily is my daughter"
    inverted_rel = re.search(r"\b([A-Z][a-z]+)\s+is\s+my\s+(daughter|son|wife|husband|sister|brother|granddaughter|grandson|friend)\b", t, re.I)
    rel_match = re.search(r"my\s+(daughter|son|wife|husband|sister|brother|granddaughter|grandson|friend)(?:\s+named|\s+called|\s+is)?\s+([A-Z][a-z]+)?", t, re.I)
    name_match = re.search(r"\b(emily|sarah|john|michael|david|anna|mary|robert|linda)\b", t_lower)
    
    person_name = None
    stopwords = {"and", "is", "was", "who", "called", "she", "he", "it", "to", "in", "at", "for", "lives", "moved", "has"}

    if inverted_rel:
        person_name = inverted_rel.group(1).capitalize()
        kin = inverted_rel.group(2).lower()
    elif rel_match and rel_match.group(2) and rel_match.group(2).lower() not in stopwords:
        person_name = rel_match.group(2).strip().capitalize()
        kin = rel_match.group(1).lower()
    elif rel_match:
        kin = rel_match.group(1).lower()
        if name_match:
            person_name = name_match.group(1).capitalize()
    elif name_match:
        person_name = name_match.group(1).capitalize()
        kin = "family member"
    else:
        kin = None

    # Fact 1: Visit / Event
    if "visit" in t_lower or "coming" in t_lower or "sunday" in t_lower or "tomorrow" in t_lower:
        rel_date_str = None
        for word in ("next sunday", "sunday", "tomorrow", "next week", "today"):
            if word in t_lower:
                rel_date_str = word
                break
        resolved_date, _, _ = resolve_relative_date(rel_date_str or "", reference_dt, tz_name)
        event_title = f"{person_name or 'Family'}'s visit" if person_name else "Upcoming visit"
        content = f"{person_name or 'A visitor'} is visiting the patient {rel_date_str or 'soon'}."
        candidates.append(ExtractedFactCandidate(
            title=event_title,
            content=content,
            memory_type="EVENT",
            entities=[person_name] if person_name else ["Family"],
            event_date=resolved_date,
            relative_date_text=rel_date_str,
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=80.0,
            usefulness_estimate=85.0,
            persistence_estimate=30.0,
        ))

    # Fact 2: Relationship explicit ("Emily is my daughter")
    if kin and (inverted_rel or (rel_match and not any(c.memory_type == "EVENT" and "visit" in c.title.lower() for c in candidates)) or ("daughter" in t_lower or "son" in t_lower or "wife" in t_lower or "husband" in t_lower)):
        candidates.append(ExtractedFactCandidate(
            title=f"Relationship: {person_name or kin.capitalize()}",
            content=f"{person_name or 'The person'} is the patient's {kin}.",
            memory_type="RELATIONSHIP",
            entities=[person_name, kin] if person_name else [kin],
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=90.0,
            usefulness_estimate=95.0,
            persistence_estimate=95.0,
        ))

    # Fact 3: Preferences / Daily Activities (e.g. evening walk, favourite food, routine)
    if "walk" in t_lower or "prefer" in t_lower or "i like" in t_lower or "my routine" in t_lower or "favorite" in t_lower or "favourite" in t_lower:
        pref_title = "Personal preference"
        pref_content = t
        if "walk" in t_lower:
            pref_title = "Evening walk preference" if "evening" in t_lower else "Walking routine preference"
            time_match = re.search(r"\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b", t, re.I)
            time_str = time_match.group(1) if time_match else "at scheduled time"
            pref_content = f"The patient prefers to take an evening walk at {time_str}." if "evening" in t_lower else f"The patient prefers walking {time_str}."
        elif "favorite" in t_lower or "favourite" in t_lower or "i like" in t_lower:
            pref_title = "Patient favorite"
            pref_content = f"Patient preference: {t}"
        candidates.append(ExtractedFactCandidate(
            title=pref_title,
            content=pref_content,
            memory_type="PREFERENCE",
            entities=["evening walk" if "evening" in t_lower and "walk" in t_lower else "routine"],
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=75.0,
            usefulness_estimate=85.0,
            persistence_estimate=80.0,
        ))

    # Fact 4: Appointment
    if ("appointment" in t_lower or "doctor" in t_lower or "dr." in t_lower or "dentist" in t_lower) and not any(c.memory_type == "APPOINTMENT" for c in candidates):
        candidates.append(ExtractedFactCandidate(
            title="Medical appointment mentioned",
            content=t[:500],
            memory_type="APPOINTMENT",
            entities=["Doctor"],
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=85.0,
            usefulness_estimate=90.0,
            persistence_estimate=40.0,
        ))

    # Fact 5: Medicine
    has_med_words = any(m in t_lower for m in ("medicine", "tablet", "pill", "prescription", "metformin", "aspirin", "insulin", "dose", "dosage")) or bool(re.search(r"\b\d+\s*(?:mg|ml|mcg|tablets?|pills?)\b", t_lower))
    if has_med_words and not any(c.memory_type == "MEDICINE" for c in candidates):
        candidates.append(ExtractedFactCandidate(
            title="Medicine information",
            content=t[:500],
            memory_type="MEDICINE",
            entities=["Medicine"],
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=85.0,
            usefulness_estimate=90.0,
            persistence_estimate=50.0,
        ))

    # Fact 6: General Important Fact / Blood type / Allergy / Remember
    has_fact_words = any(k in t_lower for k in ("blood type", "blood group", "allergic", "allergy", "born in", "live in", "living in", "remember"))
    if has_fact_words and not any(c.memory_type == "IMPORTANT_FACT" for c in candidates):
        fact_title = "Important personal fact"
        if "blood" in t_lower:
            fact_title = "Blood type record"
        elif "allergic" in t_lower or "allergy" in t_lower:
            fact_title = "Allergy record"
        candidates.append(ExtractedFactCandidate(
            title=fact_title,
            content=t[:500],
            memory_type="IMPORTANT_FACT",
            entities=["Medical/Personal Fact"],
            confidence=round(base_conf, 2),
            requires_confirmation=requires_conf,
            importance_estimate=85.0,
            usefulness_estimate=85.0,
            persistence_estimate=75.0,
        ))

    return candidates


class MemoryExtractionService:
    """Service to extract one or more structured memory candidates from patient conversation."""

    @staticmethod
    def extract_candidates(
        patient_message: str,
        assistant_reply: str = "",
        conversation_id: Optional[str] = None,
        message_id: Optional[str] = None,
        reference_dt: Optional[datetime] = None,
        tz_name: Optional[str] = None,
        speech_confidence: float = 1.0,
    ) -> List[ExtractedFactCandidate]:
        from config.settings import MISTRAL_API_KEY

        if reference_dt is None:
            reference_dt = datetime.now(timezone.utc)

        if not MISTRAL_API_KEY:
            candidates = _offline_extract_candidates(
                patient_message, assistant_reply, reference_dt, tz_name, speech_confidence
            )
            for c in candidates:
                c.source_conversation_id = conversation_id
                c.source_message_id = message_id
            return candidates

        try:
            from agent.llm import chat_llm
            llm = chat_llm()
            prompt = MULTI_EXTRACTION_PROMPT.format(
                patient=(patient_message or "")[:1500],
                assistant=(assistant_reply or "")[:1500],
                ref_date=reference_dt.date().isoformat(),
            )
            resp = llm.invoke(prompt)
            text = getattr(resp, "content", str(resp))
            start, end = text.find("{"), text.rfind("}")
            if start == -1 or end == -1:
                return _offline_extract_candidates(patient_message, assistant_reply, reference_dt, tz_name, speech_confidence)

            data = json.loads(text[start:end + 1])
            raw_candidates = data.get("candidates", []) if isinstance(data, dict) else []
            validated: List[ExtractedFactCandidate] = []

            for item in raw_candidates:
                if not isinstance(item, dict):
                    continue
                # Resolve relative date if given
                rel_text = item.get("relative_date_text")
                if rel_text and not item.get("event_date"):
                    res_date, orig_expr, conf_needed = resolve_relative_date(rel_text, reference_dt, tz_name)
                    item["event_date"] = res_date
                    if conf_needed:
                        item["requires_confirmation"] = True

                # Factor in speech confidence if below 1.0
                if speech_confidence < 1.0:
                    item_conf = float(item.get("confidence", 0.8))
                    item["confidence"] = round(item_conf * speech_confidence, 2)
                    if speech_confidence < 0.70:
                        item["requires_confirmation"] = True

                item["source_conversation_id"] = conversation_id
                item["source_message_id"] = message_id

                cand = validate_candidate(item)
                if cand:
                    validated.append(cand)

            return validated
        except Exception:
            candidates = _offline_extract_candidates(
                patient_message, assistant_reply, reference_dt, tz_name, speech_confidence
            )
            for c in candidates:
                c.source_conversation_id = conversation_id
                c.source_message_id = message_id
            return candidates


# Backwards compatibility function
def extract_memory_candidate(patient_message: str, assistant_reply: str) -> dict:
    """Legacy helper returning a dict for backward compatibility with existing tests."""
    cands = MemoryExtractionService.extract_candidates(patient_message, assistant_reply)
    if not cands:
        return {"should_create_memory": False}
    first = cands[0]
    return {
        "should_create_memory": True,
        "memory_type": first.memory_type,
        "title": first.title,
        "content": first.content,
        "importance": "HIGH" if (first.importance_estimate or 50) >= 75 else ("LOW" if (first.importance_estimate or 50) < 40 else "MEDIUM"),
        "confidence": first.confidence,
    }
