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

export interface MedicineExtraction {
  medicine: string;
  dosage: string;
  timing: string;
  frequency: string;
}
