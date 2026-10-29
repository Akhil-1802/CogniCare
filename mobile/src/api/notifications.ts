import api from "./client";
import type { NotificationItem } from "../types";

export interface NotificationCounts {
  pending_questions?: number;
  unread_answers?: number;
}

export const NotificationsApi = {
  async getPatientNotifications(limit = 50): Promise<NotificationItem[]> {
    const res = await api.get<NotificationItem[]>("/notifications/patient", {
      params: { limit },
    });
    return res.data;
  },

  async getCaretakerNotifications(limit = 50): Promise<NotificationItem[]> {
    const res = await api.get<NotificationItem[]>("/notifications/caretaker", {
      params: { limit },
    });
    return res.data;
  },

  async sendInquiry(
    question: string,
    category = "general",
    metadata?: Record<string, unknown>
  ): Promise<{ message: string; notification: NotificationItem }> {
    const res = await api.post("/notifications/inquiry", {
      question,
      category,
      metadata,
    });
    return res.data;
  },

  async respondToNotification(
    notificationId: string,
    response: string,
    category?: string
  ): Promise<{
    message: string;
    notification_id: string;
    memory: unknown;
    status: string;
  }> {
    const res = await api.post(`/notifications/${notificationId}/respond`, {
      response,
      category,
    });
    return res.data;
  },

  async markNotificationRead(notificationId: string): Promise<{ message: string }> {
    const res = await api.patch(`/notifications/${notificationId}/read`);
    return res.data;
  },

  async getCounts(): Promise<NotificationCounts> {
    const res = await api.get<NotificationCounts>("/notifications/counts");
    return res.data;
  },
};
