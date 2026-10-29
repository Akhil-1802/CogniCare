import api from "./client";
import type { PatientDocumentItem, StructuredMedicalData, ExtractedMedication } from "../types";

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

export const DocumentsApi = {
  async scanDocumentPreview(
    fileUri: string,
    fileName: string,
    mimeType: string
  ): Promise<OcrScanResponse> {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName || "document.jpg",
      type: mimeType || "image/jpeg",
    } as any);

    const res = await api.post<OcrScanResponse>("/documents/ocr-scan", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async uploadMedicalDocument(
    fileUri: string,
    fileName: string,
    mimeType: string,
    patientId?: string,
    title?: string,
    documentType = "prescription"
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName || "prescription.jpg",
      type: mimeType || "image/jpeg",
    } as any);

    if (patientId) formData.append("patient_id", patientId);
    if (title) formData.append("title", title);
    if (documentType) formData.append("document_type", documentType);

    const res = await api.post<DocumentUploadResponse>("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async getPatientDocuments(patientId: string): Promise<PatientDocumentItem[]> {
    const res = await api.get<PatientDocumentItem[]>(`/documents/patient/${patientId}`);
    return res.data;
  },

  async deletePatientDocument(documentId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/documents/${documentId}`);
    return res.data;
  },
};
