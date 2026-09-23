import api from "./api";

export interface ExtractedMedication {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  instructions: string;
  purpose?: string | null;
}

export interface StructuredMedicalData {
  document_type: string;
  summary: string;
  doctor_name?: string | null;
  clinic_or_hospital?: string | null;
  medications: ExtractedMedication[];
  conditions?: string[];
  doctor_notes?: string;
}

export interface PatientDocumentItem {
  id: string;
  patient_id: string;
  uploaded_by: string;
  uploader_role: string;
  title: string;
  document_type: string;
  raw_ocr_text: string;
  structured_data: StructuredMedicalData;
  file_name: string;
  file_type: string;
  created_at: string;
}

export interface DocumentUploadResponse {
  message: string;
  document: PatientDocumentItem;
  ocr_duration_ms: number;
  medications_count: number;
  medications: ExtractedMedication[];
}

export interface OcrScanResponse {
  success: boolean;
  filename: string;
  ocr: {
    text: string;
    pages: number;
    confidence: number;
    duration_ms: number;
    file_type: string;
  };
  extracted_data: StructuredMedicalData;
}

export async function uploadMedicalDocument(
  file: File,
  patientId?: string,
  title?: string,
  documentType: string = "prescription"
) {
  const formData = new FormData();
  formData.append("file", file);
  if (patientId) formData.append("patient_id", patientId);
  if (title) formData.append("title", title);
  if (documentType) formData.append("document_type", documentType);

  const res = await api.post<DocumentUploadResponse>("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function scanDocumentPreview(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await api.post<OcrScanResponse>("/documents/ocr-scan", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getPatientDocuments(patientId: string) {
  const res = await api.get<PatientDocumentItem[]>(`/documents/patient/${patientId}`);
  return res.data;
}

export async function deletePatientDocument(documentId: string) {
  const res = await api.delete<{ message: string }>(`/documents/${documentId}`);
  return res.data;
}
