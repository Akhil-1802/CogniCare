import api from "./client";
import type { Reminder, DetectedMedicineInfo } from "../types";

export interface AssistantChatResponse {
  conversation_id: string;
  response: string;
  tools_used: string[];
  sources: string[];
  memory: { created: boolean; [k: string]: unknown };
  disclaimer: string;
  rate_limited?: boolean;
  suggest_caretaker_escalation?: boolean;
  escalation_question?: string | null;
  notification_created?: unknown;
  routine_saved?: Reminder | null;
  detected_medicine?: DetectedMedicineInfo;
  ocr_summary?: string;
  ocr_duration_ms?: number;
  file_name?: string;
}

export interface ConversationItem {
  id: string;
  patient_id: string;
  created_at: string;
  preview?: string;
}

export interface ConversationMessage {
  id: string;
  sender_type: "PATIENT" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  created_at: string;
  tools_used?: string[];
}

export const AssistantApi = {
  async chat(message: string, conversationId?: string | null): Promise<AssistantChatResponse> {
    const res = await api.post<AssistantChatResponse>("/assistant/chat", {
      message,
      conversation_id: conversationId || null,
    });
    return res.data;
  },

  async chatWithFile(
    fileUri: string,
    fileName: string,
    mimeType: string,
    message?: string,
    conversationId?: string | null
  ): Promise<AssistantChatResponse> {
    const formData = new FormData();
    // React Native multipart file upload format
    formData.append("file", {
      uri: fileUri,
      name: fileName || "medicine_image.jpg",
      type: mimeType || "image/jpeg",
    } as any);

    if (message) formData.append("message", message);
    if (conversationId) formData.append("conversation_id", conversationId);

    const res = await api.post<AssistantChatResponse>("/assistant/chat-with-file", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data;
  },

  async getConversations(limit = 20): Promise<ConversationItem[]> {
    const res = await api.get<ConversationItem[]>("/assistant/conversations", {
      params: { limit },
    });
    return res.data;
  },

  async getConversation(id: string): Promise<{ conversation: unknown; messages: ConversationMessage[] }> {
    const res = await api.get(`/assistant/conversations/${id}`);
    return res.data;
  },

  async getCaretakerConversations(patientId: string): Promise<ConversationItem[]> {
    const res = await api.get<ConversationItem[]>(`/caretaker/patients/${patientId}/conversations`);
    return res.data;
  },

  async getCaretakerConversationDetail(
    patientId: string,
    conversationId: string
  ): Promise<{ conversation: unknown; messages: ConversationMessage[] }> {
    const res = await api.get(`/caretaker/patients/${patientId}/conversations/${conversationId}`);
    return res.data;
  },

  async getAiActivity(patientId: string) {
    const res = await api.get(`/caretaker/patients/${patientId}/ai-activity`);
    return res.data;
  },

  async validateMemory(
    memoryId: string,
    status: "ACTIVE" | "REJECTED",
    editTitle?: string,
    editContent?: string
  ) {
    const res = await api.post(`/caretaker/memories/${memoryId}/validate`, {
      status,
      edit_title: editTitle,
      edit_content: editContent,
    });
    return res.data;
  },

  async escalateQuestion(question: string, conversationId?: string | null) {
    const res = await api.post("/assistant/escalate", {
      question,
      conversation_id: conversationId || null,
    });
    return res.data;
  },
};
