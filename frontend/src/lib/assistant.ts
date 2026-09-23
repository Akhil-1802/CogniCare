import api from "./api";

export interface DetectedMedicineInfo {
  status: "VERIFIED" | "NOT_FOUND" | "MULTIPLE";
  found: boolean;
  detected_name: string;
  detected_dosage?: string;
  timing?: string;
  frequency?: string;
  advisory?: string;
  matched_record?: {
    source?: string;
    name?: string;
    content?: string;
    document_title?: string;
  } | null;
  all_active_prescriptions?: string[];
  suggest_caretaker_escalation?: boolean;
}

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

export async function postAssistantChat(message: string, conversationId?: string | null) {
  const res = await api.post<AssistantChatResponse>("/assistant/chat", {
    message,
    conversation_id: conversationId || null,
  });
  return res.data;
}

export async function postAssistantChatWithFile(
  file: File,
  message?: string,
  conversationId?: string | null
) {
  const formData = new FormData();
  formData.append("file", file);
  if (message) formData.append("message", message);
  if (conversationId) formData.append("conversation_id", conversationId);

  const res = await api.post<AssistantChatResponse>("/assistant/chat-with-file", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function getConversations(limit = 20) {
  const res = await api.get<ConversationItem[]>("/assistant/conversations", {
    params: { limit },
  });
  return res.data;
}

export async function getConversation(id: string) {
  const res = await api.get<{ conversation: unknown; messages: ConversationMessage[] }>(
    `/assistant/conversations/${id}`
  );
  return res.data;
}

export async function getCaretakerConversations(patientId: string) {
  const res = await api.get<ConversationItem[]>(
    `/caretaker/patients/${patientId}/conversations`
  );
  return res.data;
}

export async function getCaretakerConversationDetail(patientId: string, conversationId: string) {
  const res = await api.get<{ conversation: unknown; messages: ConversationMessage[] }>(
    `/caretaker/patients/${patientId}/conversations/${conversationId}`
  );
  return res.data;
}

export interface AiActivity {
  date: string;
  daily_summary: { summary: string; important_events: string[] } | null;
  recent_conversations: ConversationItem[];
  important_memories: { id: string; title: string; content: string }[];
  pending_validation: { id: string; title: string; content: string; memory_type: string; confidence: number }[];
}

export async function getAiActivity(patientId: string) {
  const res = await api.get<AiActivity>(`/caretaker/patients/${patientId}/ai-activity`);
  return res.data;
}

export async function validateMemory(memoryId: string, status: "ACTIVE" | "REJECTED") {
  const res = await api.post(`/caretaker/memories/${memoryId}/validate`, { status });
  return res.data;
}
