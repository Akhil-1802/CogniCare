"""Integration test for full Document OCR and Medical Records Cross-Referencing pipeline."""

import io
from PIL import Image, ImageDraw
import pymupdf
from services.ocr_service import process_document_ocr
from services.medical_record_service import (
    extract_medical_data_from_ocr,
    save_patient_medical_document,
    compare_medicine_with_records,
    get_patient_documents
)
from agent.tools_impl import search_patient_documents


def test_full_caretaker_upload_and_patient_cross_reference():
    patient_id = "test_patient_integration_001"

    # Step 1: Caretaker uploads a prescription PDF
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)
    sample_prescription = (
        "CogniCare Hospital & Clinic\n"
        "Doctor: Dr. Sarah Johnson, MD\n"
        "Patient ID: test_patient_integration_001\n"
        "Date: 2026-09-20\n\n"
        "Prescriptions:\n"
        "1. Metformin 500mg twice daily with meals for diabetes control.\n"
        "2. Lisinopril 10mg once daily in the morning for hypertension.\n"
        "Instructions: Take with plenty of water. Monitor blood pressure weekly."
    )
    page.insert_text((50, 72), sample_prescription, fontsize=12)
    pdf_bytes = doc.tobytes()

    # Step 2: OCR Extraction
    ocr_result = process_document_ocr(pdf_bytes, "prescription_sarah.pdf", "application/pdf")
    assert ocr_result["file_type"] == "pdf"
    assert "Metformin 500mg" in ocr_result["text"]
    assert "Lisinopril 10mg" in ocr_result["text"]
    assert ocr_result["duration_ms"] < 2000

    # Step 3: Medical entity parsing
    structured_data = extract_medical_data_from_ocr(ocr_result["text"])
    assert "medications" in structured_data
    med_names = [m["name"].lower() for m in structured_data["medications"]]
    assert any("metformin" in n for n in med_names)

    # Step 4: Persist document and index into patient memory
    saved_doc = save_patient_medical_document(
        patient_id=patient_id,
        uploaded_by="caretaker_001",
        uploader_role="CareTaker",
        filename="prescription_sarah.pdf",
        file_type="pdf",
        ocr_text=ocr_result["text"],
        structured_data=structured_data,
        title="Dr. Sarah Johnson Prescription"
    )
    assert saved_doc["id"].startswith("doc_")

    # Step 5: Test search_patient_documents tool
    found_docs = search_patient_documents(patient_id, "Metformin")
    assert len(found_docs) > 0
    assert "sarah" in found_docs[0]["title"].lower() or "prescription" in found_docs[0]["title"].lower()

    # Step 6: Patient uploads a pill image of Metformin and asks if they should take it
    img = Image.new("RGB", (400, 100), color=(255, 255, 255))
    d = ImageDraw.Draw(img)
    d.text((20, 35), "Metformin 500mg", fill=(0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img_ocr = process_document_ocr(buf.getvalue(), "pill_photo.png", "image/png")

    img_meds = extract_medical_data_from_ocr(img_ocr["text"]).get("medications", [])
    verified_check = compare_medicine_with_records(patient_id, img_meds, img_ocr["text"])

    assert verified_check["status"] == "VERIFIED"
    assert verified_check["found"] is True
    assert verified_check["suggest_caretaker_escalation"] is False
    assert "Metformin" in verified_check["detected_name"]

    # Step 7: Patient uploads an unknown/unprescribed pill image (e.g. Tramadol)
    unlisted_check = compare_medicine_with_records(
        patient_id,
        [{"name": "Tramadol", "dosage": "50mg"}],
        "Tramadol 50mg capsule"
    )
    assert unlisted_check["status"] == "NOT_FOUND"
    assert unlisted_check["found"] is False
    assert unlisted_check["suggest_caretaker_escalation"] is True
    assert "Caution" in unlisted_check["advisory"]
