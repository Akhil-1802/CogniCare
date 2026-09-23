"""Unit tests for OCR service and Medical Records cross-referencing."""

import pytest
import io
from PIL import Image, ImageDraw
import pymupdf
from services.ocr_service import (
    extract_text_from_image_bytes,
    extract_text_from_pdf_bytes,
    process_document_ocr
)
from services.medical_record_service import (
    extract_medical_data_from_ocr,
    compare_medicine_with_records,
    _rule_based_medication_extraction,
    _LOCAL_DOCUMENTS
)


def test_image_ocr_text_extraction():
    # Create synthetic image with text
    img = Image.new("RGB", (450, 100), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 35), "Metformin 500mg Twice Daily", fill=(0, 0, 0))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_bytes = buf.getvalue()

    text, conf = extract_text_from_image_bytes(img_bytes)
    assert "Metformin" in text or "500mg" in text
    assert conf > 0.5


def test_pdf_direct_extraction():
    # Create in-memory PDF with digital text
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    sample_text = (
        "CogniCare Clinic - Medical Prescription\n"
        "Patient: John Doe\n"
        "Rx: Lisinopril 10mg once daily in the morning for hypertension.\n"
        "Take after breakfast."
    )
    page.insert_text((50, 100), sample_text, fontsize=12)
    pdf_bytes = doc.tobytes()

    text, pages, conf = extract_text_from_pdf_bytes(pdf_bytes)
    assert pages == 1
    assert "Lisinopril 10mg" in text
    assert "hypertension" in text
    assert conf >= 0.9


def test_rule_based_medication_parsing():
    sample_ocr = (
        "Rx: Atorvastatin 20mg once daily at bedtime.\n"
        "Metformin 500mg twice daily with meals."
    )
    extracted = _rule_based_medication_extraction(sample_ocr)
    assert "medications" in extracted
    names = [m["name"].lower() for m in extracted["medications"]]
    assert any("atorvastatin" in n for n in names)
    assert any("metformin" in n for n in names)


def test_medicine_cross_reference_matching():
    patient_id = "test_patient_123"

    # Add a mock document into _LOCAL_DOCUMENTS for patient_id
    _LOCAL_DOCUMENTS.append({
        "id": "doc_test_1",
        "patient_id": patient_id,
        "title": "Prescription - Dr. Smith",
        "structured_data": {
            "medications": [
                {
                    "name": "Metformin",
                    "dosage": "500mg",
                    "frequency": "Twice daily",
                    "timing": "With meals",
                    "instructions": "Take with water"
                }
            ]
        }
    })

    # 1. Matching medicine
    res_verified = compare_medicine_with_records(
        patient_id=patient_id,
        detected_medications=[{"name": "Metformin", "dosage": "500mg"}],
        raw_ocr_text="Metformin 500mg"
    )
    assert res_verified["status"] == "VERIFIED"
    assert res_verified["found"] is True
    assert res_verified["suggest_caretaker_escalation"] is False

    # 2. Unlisted medicine
    res_unlisted = compare_medicine_with_records(
        patient_id=patient_id,
        detected_medications=[{"name": "Tramadol", "dosage": "50mg"}],
        raw_ocr_text="Tramadol 50mg"
    )
    assert res_unlisted["status"] == "NOT_FOUND"
    assert res_unlisted["found"] is False
    assert res_unlisted["suggest_caretaker_escalation"] is True
    assert "Caution" in res_unlisted["advisory"]
