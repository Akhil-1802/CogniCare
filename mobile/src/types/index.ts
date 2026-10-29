export type MemoryCategory =
  | "Object Location"
  | "Medicine Reminder"
  | "Appointment"
  | "Social Visit"
  | "Medical Document"
  | "Important Fact"
  | "Preference";

export interface Memory {
  id: string;
  patient_id?: string;
  category?: MemoryCategory;
  memory_type?: string;
  title: string;
  content?: string;
  description?: string;
  icon?: string;
  date?: string;
  created_at?: string;
  dateGroup?: "Today" | "Yesterday" | "Earlier";
  source?: string;
  confidence?: number;
  total_score?: number;
  importance_score?: number;
  confidence_score?: number;
  usefulness_score?: number;
  persistence_score?: number;
  novelty_score?: number;
  status?: "ACTIVE" | "PENDING_VALIDATION" | "ARCHIVED" | "REJECTED";
  retention_policy?: "STANDARD" | "TEMPORARY" | "LONG_TERM";
  retention_days?: number;
  expires_at?: string;
  last_confirmed_at?: string;
  details?: Record<string, string>;
  metadata?: {
    reason?: string;
    conflict_with?: string;
    score_breakdown?: {
      importance?: number;
      confidence?: number;
      usefulness?: number;
      persistence?: number;
      novelty?: number;
      total_score?: number;
    };
    [key: string]: any;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  tools_used?: string[];
  memoryExtracted?: MemoryExtraction;
  detected_medicine?: DetectedMedicineInfo;
  disclaimer?: string;
}

export interface MemoryExtraction {
  object?: string;
  location?: string;
  category?: MemoryCategory;
  status?: string;
  medicine?: string;
  dosage?: string;
  timing?: string;
  frequency?: string;
}

export interface CareTaker {
  id?: string;
  name: string;
  relationship?: string;
  status?: "Online" | "Offline" | string;
  avatar?: string;
  email?: string;
  phone?: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  location: string;
  caretaker_id: string;
  caretaker?: CareTaker | null;
  created_at?: string;
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
  dosage?: string;
  reminder_time: string;
  notes?: string;
}

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

export interface AiActivity {
  date: string;
  daily_summary: { summary: string; important_events: string[] } | null;
  recent_conversations: {
    id: string;
    patient_id: string;
    created_at: string;
    preview?: string;
  }[];
  important_memories: { id: string; title: string; content: string }[];
  pending_validation: Memory[];
}
