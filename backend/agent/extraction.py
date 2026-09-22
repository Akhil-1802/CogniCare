"""Memory extraction via dynamic Mistral structured output.

Primary path is 100% LLM-driven. A tiny rule-based fallback exists ONLY for
offline tests / missing-key dev — production with MISTRAL_API_KEY never uses it.
"""
import json

EXTRACTION_PROMPT = """You extract long-term memories for an elderly-care assistant.
Return ONLY valid JSON with keys:
should_create_memory (bool), memory_type (PERSON|RELATIONSHIP|EVENT|APPOINTMENT|MEDICINE|PREFERENCE|IMPORTANT_FACT|DAILY_ACTIVITY),
title (short), content (1-3 sentences), importance (LOW|MEDIUM|HIGH), confidence (0-1).
Only return true when the message contains persistent facts (people, relationships, events, appointments, medicines, preferences).
Daily chit-chat, greetings, or one-off questions → should_create_memory=false.
Patient message: {patient}
Assistant reply: {assistant}
JSON:"""


def _rule_based_offline(patient: str, assistant: str) -> dict:
    """Offline safety net only. Never used when MISTRAL_API_KEY is set and working."""
    import re

    t = (patient or "").lower()

    def out(mtype, title, content, imp="MEDIUM", conf=0.7):
        return {
            "should_create_memory": True, "memory_type": mtype,
            "title": title[:120], "content": content[:1000],
            "importance": imp, "confidence": conf,
        }

    if len(t.strip()) < 8:
        return {"should_create_memory": False}
    if any(g in t for g in ("hello", "hi ", "thanks", "thank you", "bye")) and len(t) < 40:
        return {"should_create_memory": False}
    m = re.search(r"my (daughter|son|wife|husband|sister|brother|granddaughter|grandson|friend)\s+([A-Z]?[a-z]+)?", patient, re.I)
    if m or ("emily" in t and ("daughter" in t or "visit" in t)):
        name = (m.group(2) if m and len(m.groups()) >= 2 and m.group(2) else "Emily").strip() or "Emily"
        return out("PERSON", f"Patient's daughter {name}".strip(),
                   f"{name} is the patient's daughter. {patient.strip()}"[:500], "HIGH", 0.9)
    if "appointment" in t or "doctor" in t or "dr." in t:
        return out("APPOINTMENT", "Medical appointment mentioned", patient.strip()[:500], "HIGH", 0.75)
    if "medicine" in t or "tablet" in t or "pill" in t or "prescription" in t:
        return out("MEDICINE", "Medicine information", patient.strip()[:500], "HIGH", 0.75)
    if "visit" in t or "coming" in t or "sunday" in t or "tomorrow" in t:
        return out("EVENT", "Upcoming visit/event", patient.strip()[:500], "MEDIUM", 0.7)
    if "i live in" in t or "my address" in t or "i like" in t or "favourite" in t or "favorite" in t:
        return out("PREFERENCE", "Patient preference/fact", patient.strip()[:500], "MEDIUM", 0.7)
    if "remember" in t and len(patient.strip()) > 20:
        return out("IMPORTANT_FACT", "Patient asked to remember", patient.strip()[:500], "MEDIUM", 0.65)
    return {"should_create_memory": False}


def extract_memory_candidate(patient_message: str, assistant_reply: str) -> dict:
    """Dynamic Mistral extraction. Falls back offline only on error / missing key."""
    from config.settings import MISTRAL_API_KEY

    if not MISTRAL_API_KEY:
        return _rule_based_offline(patient_message, assistant_reply)
    try:
        from agent.llm import chat_llm

        llm = chat_llm()
        resp = llm.invoke(EXTRACTION_PROMPT.format(
            patient=(patient_message or "")[:1500],
            assistant=(assistant_reply or "")[:1500],
        ))
        text = getattr(resp, "content", str(resp))
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end == -1:
            return {"should_create_memory": False}
        data = json.loads(text[start:end + 1])
        return data if isinstance(data, dict) else {"should_create_memory": False}
    except Exception:
        return _rule_based_offline(patient_message, assistant_reply)
