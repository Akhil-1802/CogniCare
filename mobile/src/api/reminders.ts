import api from "./client";
import type { Reminder, ReminderDraft } from "../types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isReminderEditable(r: Reminder, now = new Date()): boolean {
  if (r.is_done) return false;
  const dt = new Date(`${r.reminder_date}T${r.reminder_time.slice(0, 5)}:00`);
  return dt.getTime() > now.getTime();
}

export function reminderStatus(r: Reminder, now = new Date()): "Done" | "Overdue" | "Pending" {
  if (r.is_done) return "Done";
  const dt = new Date(`${r.reminder_date}T${r.reminder_time.slice(0, 5)}:00`);
  return dt.getTime() <= now.getTime() ? "Overdue" : "Pending";
}

export const RemindersApi = {
  async fetchMyReminders(date?: string): Promise<Reminder[]> {
    const res = await api.get<Reminder[]>("/reminders/", {
      params: date ? { date } : {},
    });
    return res.data;
  },

  async fetchPatientReminders(patientId: string, date?: string): Promise<Reminder[]> {
    const res = await api.get<Reminder[]>(`/reminders/patient/${patientId}`, {
      params: date ? { date } : {},
    });
    return res.data;
  },

  async addRemindersBulk(
    patientId: string,
    reminderDate: string,
    reminders: ReminderDraft[]
  ): Promise<{ message: string; count: number }> {
    const res = await api.post("/reminders/bulk", {
      patient_id: patientId,
      reminder_date: reminderDate,
      reminders: reminders.map((r) => ({
        title: r.title,
        type: r.type,
        dosage: r.dosage || null,
        reminder_time: r.reminder_time,
        notes: r.notes || null,
      })),
    });
    return res.data;
  },

  async createSingleReminder(data: {
    patient_id: string;
    title: string;
    type?: string;
    reminder_date: string;
    reminder_time: string;
    dosage?: string | null;
    notes?: string | null;
  }): Promise<{ message: string; reminder_id: string }> {
    const res = await api.post("/reminders/", {
      patient_id: data.patient_id,
      title: data.title,
      type: data.type || "general",
      reminder_date: data.reminder_date,
      reminder_time: data.reminder_time,
      dosage: data.dosage || null,
      notes: data.notes || null,
    });
    return res.data;
  },

  async updateReminder(
    reminderId: string,
    payload: Partial<Reminder> & { is_done?: boolean }
  ) {
    const res = await api.patch(`/reminders/${reminderId}`, payload);
    return res.data;
  },

  async deleteReminder(reminderId: string) {
    const res = await api.delete(`/reminders/${reminderId}`);
    return res.data;
  },
};
