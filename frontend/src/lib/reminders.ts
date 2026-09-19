import api from "./api";
import type { Reminder, ReminderDraft } from "@/types";

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchPatientReminders(
  patientId: string,
  date?: string
): Promise<Reminder[]> {
  const res = await api.get(`/reminders/patient/${patientId}`, {
    params: date ? { date } : {},
  });
  return res.data;
}

export async function fetchMyReminders(date?: string): Promise<Reminder[]> {
  const res = await api.get("/reminders/", {
    params: date ? { date } : {},
  });
  return res.data;
}

export async function addRemindersBulk(
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
}

export async function updateReminder(
  reminderId: string,
  payload: Partial<Reminder> & { is_done?: boolean }
) {
  const res = await api.patch(`/reminders/${reminderId}`, payload);
  return res.data;
}

export async function deleteReminder(reminderId: string) {
  const res = await api.delete(`/reminders/${reminderId}`);
  return res.data;
}

/** Editable only when not done AND datetime is in the future. */
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
