export type MemoryCategory =
  | "Object Location"
  | "Medicine Reminder"
  | "Appointment"
  | "Social Visit"
  | "Medical Document";

export interface Memory {
  id: string;
  category: MemoryCategory;
  title: string;
  description: string;
  icon: string;
  date: string;
  dateGroup: "Today" | "Yesterday" | "Earlier";
  source: string;
  confidence: number;
  details: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  memoryExtracted?: MemoryExtraction;
}

export interface MemoryExtraction {
  object?: string;
  location?: string;
  category: MemoryCategory;
  status: string;
  medicine?: string;
  dosage?: string;
  timing?: string;
  frequency?: string;
}

export interface CareTaker {
  name: string;
  relationship: string;
  status: "Online" | "Offline";
  avatar: string;
}

export type ReminderType = "medicine" | "appointment" | "general";

export interface Reminder {
  id: string;
  patient_id: string;
  caretaker_id: string;
  title: string;
  type: ReminderType;
  dosage?: string | null;
  reminder_date: string;
  reminder_time: string;
  notes?: string | null;
  is_done: boolean;
  done_at?: string | null;
  done_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ReminderDraft {
  title: string;
  type: ReminderType;
  dosage: string;
  reminder_time: string;
  notes: string;
}

export interface MedicineExtraction {
  medicine: string;
  dosage: string;
  timing: string;
  frequency: string;
}
