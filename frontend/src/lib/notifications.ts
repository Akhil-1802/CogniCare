import api from "./api";

export interface NotificationItem {
  id: string;
  patient_id: string;
  caretaker_id: string;
  type: "caregiver_inquiry" | "inquiry_response" | "reminder_alert" | "general";
  question: string;
  response?: string | null;
  category?: string;
  status: "pending" | "answered" | "dismissed";
  patient_read: boolean;
  caretaker_read: boolean;
  metadata?: {
    patient_name?: string;
    caretaker_name?: string;
    conversation_id?: string;
    [key: string]: unknown;
  };
  created_at: string;
  answered_at?: string | null;
  updated_at: string;
}

export interface NotificationCounts {
  pending_questions?: number;
  unread_answers?: number;
}

export async function getPatientNotifications(limit = 50) {
  const res = await api.get<NotificationItem[]>("/notifications/patient", {
    params: { limit },
  });
  return res.data;
}

export async function getCaretakerNotifications(limit = 50) {
  const res = await api.get<NotificationItem[]>("/notifications/caretaker", {
    params: { limit },
  });
  return res.data;
}

export async function sendInquiry(question: string, category = "general", metadata?: Record<string, unknown>) {
  const res = await api.post<{ message: string; notification: NotificationItem }>("/notifications/inquiry", {
    question,
    category,
    metadata,
  });
  return res.data;
}

export async function respondToNotification(notificationId: string, response: string, category?: string) {
  const res = await api.post<{
    message: string;
    notification_id: string;
    memory: unknown;
    status: string;
  }>(`/notifications/${notificationId}/respond`, {
    response,
    category,
  });
  return res.data;
}

export async function markNotificationRead(notificationId: string) {
  const res = await api.patch<{ message: string }>(`/notifications/${notificationId}/read`);
  return res.data;
}

export async function getNotificationCounts() {
  const res = await api.get<NotificationCounts>("/notifications/counts");
  return res.data;
}

export async function escalateAssistantQuestion(question: string, conversationId?: string | null) {
  const res = await api.post<{
    message: string;
    notification: NotificationItem;
    reply: string;
  }>("/assistant/escalate", {
    question,
    conversation_id: conversationId || null,
  });
  return res.data;
}

export function broadcastNotificationCount(pendingCount: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("notifications_count_updated", {
        detail: { pendingCount: Math.max(0, pendingCount) },
      })
    );
  }
}

