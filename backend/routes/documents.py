"""Medical Documents and OCR Routes.

Enables both Patients and CareTakers to upload medical records (PDFs, images, packaging photos),
runs fast OCR extraction, parses structured medications, and indexes them into the patient's
active medical record memories.
"""

from fastapi import APIRouter, Request, HTTPException, UploadFile, File, Form, Query
from typing import Optional, List
import logging
from agent.authz import get_auth_payload, require_caretaker_patient, authenticated_patient_id
from services.ocr_service import process_document_ocr
from services.medical_record_service import (
    extract_medical_data_from_ocr,
    save_patient_medical_document,
    get_patient_documents,
    _LOCAL_DOCUMENTS
)
from db.supabase import supabase

logger = logging.getLogger("cognicare.documents")

documents_router = APIRouter(prefix="/documents", tags=["Medical Documents & OCR"])


@documents_router.post("/ocr-scan")
async def ocr_scan(file: UploadFile = File(...), request: Request = None):
    """Fast preview OCR endpoint. Extracts raw text and medical entities in <1s."""
    payload = get_auth_payload(request)
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        ocr_result = process_document_ocr(file_bytes, file.filename or "uploaded_file", file.content_type)
        extracted = extract_medical_data_from_ocr(ocr_result["text"])
        return {
            "success": True,
            "filename": file.filename,
            "ocr": ocr_result,
            "extracted_data": extracted,
        }
    except Exception as e:
        logger.error(f"OCR scan failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")


@documents_router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    patient_id: Optional[str] = Form(None),
    title: Optional[str] = Form(None),
    document_type: Optional[str] = Form("prescription"),
    request: Request = None,
):
    """Uploads a medical document (PDF, JPG, PNG), runs OCR, parses medications,

    and saves to patient's active medical profile and vector memory.
    """
    payload = get_auth_payload(request)
    role = payload.get("role")

    target_patient_id: str
    if role == "Patient":
        target_patient_id = authenticated_patient_id(payload)
    elif role == "CareTaker":
        if not patient_id:
            raise HTTPException(status_code=400, detail="patient_id is required when uploading as CareTaker")
        require_caretaker_patient(payload, patient_id)
        target_patient_id = patient_id
    else:
        raise HTTPException(status_code=403, detail="Unauthorized role")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # 1. High-speed OCR
    ocr_result = process_document_ocr(file_bytes, file.filename or "medical_doc", file.content_type)

    # 2. Medical entity extraction
    structured_data = extract_medical_data_from_ocr(ocr_result["text"])
    if document_type:
        structured_data["document_type"] = document_type

    # 3. Save document and index medications into patient memories & vector store
    uploader_id = payload.get("sub", "unknown")
    doc_record = save_patient_medical_document(
        patient_id=target_patient_id,
        uploaded_by=uploader_id,
        uploader_role=role,
        filename=file.filename or "document",
        file_type=ocr_result["file_type"],
        ocr_text=ocr_result["text"],
        structured_data=structured_data,
        title=title or structured_data.get("summary") or file.filename
    )

    return {
        "message": "Medical document processed and saved to patient records successfully.",
        "document": doc_record,
        "ocr_duration_ms": ocr_result["duration_ms"],
        "medications_count": len(structured_data.get("medications", [])),
        "medications": structured_data.get("medications", []),
    }


@documents_router.get("/patient/{patient_id}")
def list_patient_documents(patient_id: str, request: Request, limit: int = Query(default=30, le=100)):
    """Lists all medical documents and prescriptions for a given patient."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    if role == "Patient":
        if authenticated_patient_id(payload) != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == "CareTaker":
        require_caretaker_patient(payload, patient_id)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    docs = get_patient_documents(patient_id, limit=limit)
    return docs


@documents_router.delete("/{document_id}")
def delete_document(document_id: str, request: Request):
    """Deletes a medical document and clears its memories."""
    payload = get_auth_payload(request)
    role = payload.get("role")

    try:
        res = supabase.table("patient_documents").select("*").eq("id", document_id).execute()
        if res.data:
            doc = res.data[0]
            if role == "Patient" and doc.get("patient_id") != payload.get("sub"):
                raise HTTPException(status_code=403, detail="Access denied")
            elif role == "CareTaker":
                require_caretaker_patient(payload, doc.get("patient_id"))

            supabase.table("patient_documents").delete().eq("id", document_id).execute()
            # Also clean up memories linked to this document
            try:
                supabase.table("memories").delete().eq("source_id", document_id).execute()
            except Exception:
                pass
            return {"message": "Document deleted successfully"}
    except Exception as e:
        logger.warning(f"Supabase delete failed ({e}), checking fallback cache.")

    # Remove from local fallback
    global _LOCAL_DOCUMENTS
    _LOCAL_DOCUMENTS = [d for d in _LOCAL_DOCUMENTS if d.get("id") != document_id]
    return {"message": "Document deleted"}
