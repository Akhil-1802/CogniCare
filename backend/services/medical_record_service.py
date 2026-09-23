"""Medical Record Parsing, Persistence, and Cross-Referencing Service.

Extracts structured medication information from OCR text, persists patient medical
documents and memories, and cross-references scanned medicines against active patient records.
"""

import json
import re
import uuid
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
from db.supabase import supabase
from agent.memory_service import create_or_update_memory
from agent import vectorstore

logger = logging.getLogger("cognicare.medical_records")

# In-memory document fallback store if patient_documents table isn't migrated yet in Supabase
_LOCAL_DOCUMENTS: List[Dict[str, Any]] = []


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


EXTRACTION_PROMPT = """You are a medical record extractor for an elderly care platform.
Analyze this medical text (prescription, medicine strip/bottle, lab report, or discharge summary).
Extract medications, conditions, instructions, and a short summary.

OCR Text:
\"\"\"{ocr_text}\"\"\"

Return ONLY valid JSON matching this exact structure:
{{
  "document_type": "prescription" | "medicine_packaging" | "lab_report" | "discharge_summary" | "other",
  "summary": "1-2 sentence plain-language summary of what this document is",
  "doctor_name": "Doctor name or null",
  "clinic_or_hospital": "Clinic name or null",
  "medications": [
    {{
      "name": "Generic or brand name of medication (e.g., Metformin, Lisinopril)",
      "dosage": "Strength/dose (e.g., 500mg, 1 tablet, 10ml)",
      "frequency": "How often (e.g., Once daily, Twice daily, Every 8 hours)",
      "timing": "When to take (e.g., Morning after breakfast, Before bedtime, With food)",
      "instructions": "Specific instructions or warnings",
      "purpose": "Condition it treats if mentioned, or null"
    }}
  ],
  "conditions": ["List of diagnosed conditions or reasons mentioned"],
  "doctor_notes": "Important cautions, dietary instructions, or follow-up notes"
}}
JSON:"""


def _rule_based_medication_extraction(text: str) -> Dict[str, Any]:
    """Lightweight rule-based fallback parser for medication text when offline or rate-limited."""
    clean = text.strip()
    medications = []

    # Common dosage and timing patterns
    # e.g. "Metformin 500mg daily", "Aspirin 81 mg once a day", "Amoxicillin 250mg 3 times a day"
    pattern = re.compile(
        r"(?:(?:tab|tablet|cap|capsule|inj|syrup|drop|rx[:\s])\s*)?"
        r"([A-Z][a-z0-9\-\/]+(?:\s+[A-Z][a-z0-9\-\/]+)?)\s+"
        r"(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|tablets?|capsules?))\b"
        r"(.*?)(?=(?:\n|\b(?:tab|tablet|cap|capsule|inj|rx|\d+\.)|\Z))",
        re.IGNORECASE
    )

    matches = pattern.findall(clean)
    for m in matches:
        name = m[0].strip()
        dosage = m[1].strip()
        rest = m[2].strip()

        # Filter out common false positives
        if name.lower() in ("dr", "date", "patient", "page", "take", "daily", "total", "pharmacy", "phone"):
            continue

        timing = "As directed"
        frequency = "Daily"
        if re.search(r"twice|bid|2\s*times|morning\s+and\s+night", rest, re.I):
            frequency = "Twice daily"
        elif re.search(r"three\s*times|tid|3\s*times", rest, re.I):
            frequency = "Three times daily"
        elif re.search(r"once|daily|qd|every\s*day|morning", rest, re.I):
            frequency = "Once daily"

        if re.search(r"after\s+(?:food|meal|breakfast|dinner|lunch)", rest, re.I):
            timing = "After meals"
        elif re.search(r"before\s+(?:food|meal|breakfast|bedtime)", rest, re.I):
            timing = "Before meals"
        elif re.search(r"bedtime|night", rest, re.I):
            timing = "At bedtime"

        medications.append({
            "name": name.capitalize(),
            "dosage": dosage,
            "frequency": frequency,
            "timing": timing,
            "instructions": rest[:120] if rest else "Take as prescribed",
            "purpose": None,
        })

    # If regex found nothing, try checking single prominent words if packaging photo
    if not medications and len(clean.split()) <= 15:
        words = [w for w in clean.split() if len(w) >= 4 and not any(c.isdigit() for c in w)]
        if words:
            medications.append({
                "name": words[0].capitalize(),
                "dosage": "Standard dose",
                "frequency": "As prescribed",
                "timing": "As directed",
                "instructions": "Packaging label detected: " + clean[:80],
                "purpose": None,
            })

    return {
        "document_type": "prescription" if "rx" in clean.lower() or "dr" in clean.lower() else "medicine_packaging",
        "summary": f"Detected {len(medications)} medication(s) from document.",
        "doctor_name": None,
        "clinic_or_hospital": None,
        "medications": medications,
        "conditions": [],
        "doctor_notes": clean[:300] if len(clean) < 300 else "",
    }


def extract_medical_data_from_ocr(ocr_text: str) -> Dict[str, Any]:
    """Extracts structured medical data from raw OCR text using Mistral or rule-based fallback."""
    from config.settings import MISTRAL_API_KEY

    if not ocr_text or not ocr_text.strip():
        return {
            "document_type": "other",
            "summary": "No text detected in document.",
            "medications": [],
            "conditions": [],
            "doctor_notes": "",
        }

    if not MISTRAL_API_KEY:
        return _rule_based_medication_extraction(ocr_text)

    try:
        from agent.llm import chat_llm, invoke_with_retry
        llm = chat_llm()
        resp = invoke_with_retry(lambda: llm.invoke(
            EXTRACTION_PROMPT.format(ocr_text=ocr_text[:3500])
        ))
        content = getattr(resp, "content", "") or ""
        start, end = content.find("{"), content.rfind("}")
        if start != -1 and end != -1:
            parsed = json.loads(content[start:end + 1])
            if isinstance(parsed, dict) and "medications" in parsed:
                return parsed
    except Exception as e:
        logger.warning(f"Mistral medical extraction failed ({e}), using rule-based fallback.")

    return _rule_based_medication_extraction(ocr_text)


def get_patient_all_medical_records(patient_id: str) -> Dict[str, Any]:
    """Retrieves all medical records for a patient:

    - Memories of type MEDICINE or IMPORTANT_FACT
    - Reminders of type medicine
    - Stored patient documents with structured medications
    """
    records: Dict[str, Any] = {
        "prescriptions": [],
        "active_medicines": [],
        "reminders": [],
        "documents": [],
    }

    # 1. Fetch memories
    try:
        res = (
            supabase.table("memories")
            .select("*")
            .eq("patient_id", patient_id)
            .in_("memory_type", ["MEDICINE", "IMPORTANT_FACT"])
            .eq("status", "ACTIVE")
            .execute()
        )
        if res.data:
            records["active_medicines"].extend(res.data)
    except Exception as e:
        logger.debug(f"Failed to fetch memories: {e}")

    # 2. Fetch medicine reminders
    try:
        r_res = (
            supabase.table("reminders")
            .select("*")
            .eq("patient_id", patient_id)
            .eq("type", "medicine")
            .execute()
        )
        if r_res.data:
            records["reminders"].extend(r_res.data)
    except Exception as e:
        logger.debug(f"Failed to fetch reminders: {e}")

    # 3. Fetch patient documents
    try:
        d_res = (
            supabase.table("patient_documents")
            .select("*")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .execute()
        )
        if d_res.data:
            records["documents"].extend(d_res.data)
    except Exception:
        # Fallback to local documents store
        local_matched = [d for d in _LOCAL_DOCUMENTS if d.get("patient_id") == patient_id]
        records["documents"].extend(local_matched)

    return records


def _normalize_name(name: str) -> str:
    """Normalizes medication names for fuzzy matching."""
    s = (name or "").lower().strip()
    s = re.sub(r"\b(tab|tablet|cap|capsule|syrup|mg|mcg|ml|hcl|hydrochloride)\b", "", s)
    s = re.sub(r"[^\w\s]", "", s)
    return " ".join(s.split())


def compare_medicine_with_records(
    patient_id: str,
    detected_medications: List[Dict[str, Any]],
    raw_ocr_text: str = ""
) -> Dict[str, Any]:
    """Compares detected medications from an image/document against patient's medical records.

    Returns:
    {
      "status": "VERIFIED" | "NOT_FOUND" | "MULTIPLE",
      "found": bool,
      "detected_name": str,
      "detected_dosage": str,
      "matched_record": Optional[dict],
      "all_active_prescriptions": list[str],
      "advisory": str,
      "suggest_caretaker_escalation": bool
    }
    """
    records = get_patient_all_medical_records(patient_id)

    # Collect all known prescribed medicine names and descriptions
    known_meds: List[Dict[str, Any]] = []

    # From memories
    for m in records["active_medicines"]:
        known_meds.append({
            "source": "memory",
            "name": m.get("title", ""),
            "content": m.get("content", ""),
            "raw": m
        })

    # From reminders
    for r in records["reminders"]:
        known_meds.append({
            "source": "reminder",
            "name": r.get("title", ""),
            "content": f"Dosage: {r.get('dosage', 'Standard')}, Time: {r.get('reminder_time', '')}, Notes: {r.get('notes', '')}",
            "raw": r
        })

    # From uploaded documents
    for doc in records["documents"]:
        struct = doc.get("structured_data") or {}
        for m in struct.get("medications", []):
            known_meds.append({
                "source": "document",
                "name": m.get("name", ""),
                "content": f"Dosage: {m.get('dosage', '')}, Frequency: {m.get('frequency', '')}, Timing: {m.get('timing', '')}, Instructions: {m.get('instructions', '')}",
                "raw": m,
                "document_title": doc.get("title", "Medical Document")
            })

    active_names = list({k["name"] for k in known_meds if k["name"]})

    if not detected_medications:
        # If no specific medication was parsed but text exists, do keyword check on known medicines
        for km in known_meds:
            norm_k = _normalize_name(km["name"])
            if norm_k and norm_k in _normalize_name(raw_ocr_text):
                return {
                    "status": "VERIFIED",
                    "found": True,
                    "detected_name": km["name"],
                    "detected_dosage": "Per prescription",
                    "matched_record": km,
                    "all_active_prescriptions": active_names,
                    "advisory": f"Matches your active prescribed medication: {km['name']}.",
                    "suggest_caretaker_escalation": False,
                }

        return {
            "status": "NOT_FOUND",
            "found": False,
            "detected_name": "Unknown Medication",
            "detected_dosage": "",
            "matched_record": None,
            "all_active_prescriptions": active_names,
            "advisory": "Could not identify a recognized medication from the image. Please verify with your caretaker.",
            "suggest_caretaker_escalation": True,
        }

    # Test primary detected medicine
    primary = detected_medications[0]
    p_name = primary.get("name", "").strip()
    norm_p = _normalize_name(p_name)

    matched_item = None
    for km in known_meds:
        norm_k = _normalize_name(km["name"])
        blob = _normalize_name(f"{km['name']} {km['content']}")

        # Direct token match or substring match
        if (norm_p and norm_p == norm_k) or (norm_p and len(norm_p) >= 4 and norm_p in blob) or (norm_k and len(norm_k) >= 4 and norm_k in norm_p):
            matched_item = km
            break

    if matched_item:
        return {
            "status": "VERIFIED",
            "found": True,
            "detected_name": p_name or matched_item["name"],
            "detected_dosage": primary.get("dosage", "As prescribed"),
            "timing": primary.get("timing", ""),
            "frequency": primary.get("frequency", ""),
            "matched_record": matched_item,
            "all_active_prescriptions": active_names,
            "advisory": f"Verified: {p_name} is listed in your medical records ({matched_item['name']}).",
            "suggest_caretaker_escalation": False,
        }
    else:
        return {
            "status": "NOT_FOUND",
            "found": False,
            "detected_name": p_name,
            "detected_dosage": primary.get("dosage", ""),
            "timing": primary.get("timing", ""),
            "frequency": primary.get("frequency", ""),
            "matched_record": None,
            "all_active_prescriptions": active_names,
            "advisory": f"Caution: '{p_name}' was NOT found in your active medical records or prescriptions. Do not take it without checking.",
            "suggest_caretaker_escalation": True,
        }


def save_patient_medical_document(
    patient_id: str,
    uploaded_by: str,
    uploader_role: str,
    filename: str,
    file_type: str,
    ocr_text: str,
    structured_data: Dict[str, Any],
    title: Optional[str] = None
) -> Dict[str, Any]:
    """Persists an uploaded medical document, indexes medications into memories,

    and embeds into ChromaDB vectorstore.
    """
    doc_id = f"doc_{uuid.uuid4().hex[:12]}"
    doc_title = title or structured_data.get("summary") or filename

    doc_record = {
        "id": doc_id,
        "patient_id": patient_id,
        "uploaded_by": uploaded_by,
        "uploader_role": uploader_role,
        "title": doc_title[:200],
        "document_type": structured_data.get("document_type", "prescription"),
        "raw_ocr_text": ocr_text,
        "structured_data": structured_data,
        "file_name": filename,
        "file_type": file_type,
        "created_at": _now(),
        "updated_at": _now(),
    }

    # Attempt Supabase insert
    try:
        res = supabase.table("patient_documents").insert(doc_record).execute()
        if res.data:
            logger.info(f"Saved document {doc_id} to Supabase patient_documents")
    except Exception as e:
        logger.warning(f"Supabase insert failed for patient_documents ({e}). Saved to local fallback.")

    _LOCAL_DOCUMENTS.insert(0, doc_record)

    # Automatically save each extracted medication into the patient's long-term memories
    medications = structured_data.get("medications", [])
    for med in medications:
        m_name = med.get("name")
        if not m_name:
            continue
        dosage = med.get("dosage") or "As prescribed"
        timing = med.get("timing") or "Daily"
        freq = med.get("frequency") or ""
        instructions = med.get("instructions") or ""

        content = (
            f"Prescribed medication: {m_name}. Dosage: {dosage}. Frequency: {freq}. "
            f"Timing: {timing}. Instructions: {instructions}. "
            f"Uploaded by {uploader_role} from {filename}."
        )

        memory_candidate = {
            "should_create_memory": True,
            "memory_type": "MEDICINE",
            "title": f"Medication: {m_name} ({dosage})",
            "content": content,
            "importance": "HIGH",
            "confidence": 0.95,
        }

        try:
            create_or_update_memory(
                patient_id=patient_id,
                candidate=memory_candidate,
                source_type="medical_document",
                source_id=doc_id,
            )
            logger.info(f"Indexed medication '{m_name}' into patient {patient_id} memories and ChromaDB.")
        except Exception as e:
            logger.warning(f"Could not index memory for medication {m_name}: {e}")

    # Also save condition notes if present
    conditions = structured_data.get("conditions", [])
    if conditions:
        c_text = f"Medical conditions from {filename}: {', '.join(conditions)}. Notes: {structured_data.get('doctor_notes', '')}"
        try:
            create_or_update_memory(
                patient_id=patient_id,
                candidate={
                    "should_create_memory": True,
                    "memory_type": "IMPORTANT_FACT",
                    "title": f"Diagnosed Conditions ({conditions[0]})",
                    "content": c_text,
                    "importance": "HIGH",
                    "confidence": 0.9,
                },
                source_type="medical_document",
                source_id=doc_id,
            )
        except Exception:
            pass

    return doc_record


def get_patient_documents(patient_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Retrieves all medical documents for a patient."""
    try:
        res = (
            supabase.table("patient_documents")
            .select("*")
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        if res.data:
            return res.data
    except Exception:
        pass

    matched = [d for d in _LOCAL_DOCUMENTS if d.get("patient_id") == patient_id]
    return matched[:limit]
