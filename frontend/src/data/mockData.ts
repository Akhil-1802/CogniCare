import type { Caregiver, Memory } from "@/types";

export const patientName = "Margaret Chen";

export const caregiver: Caregiver = {
  name: "Emily Johnson",
  relationship: "Daughter",
  status: "Online",
  avatar: "EJ",
};

export const memories: Memory[] = [
  {
    id: "1",
    category: "Object Location",
    title: "Wallet stored in Blue Drawer",
    description: "Your wallet is stored in the blue drawer in the bedroom.",
    icon: "📍",
    date: "Today, 9:15 AM",
    dateGroup: "Today",
    source: "AI Assistant Conversation",
    confidence: 94,
    details: {
      Object: "Wallet",
      Location: "Blue Drawer",
      Category: "Object Location",
      "Stored in": "Vector Database (Simulated)",
    },
  },
  {
    id: "2",
    category: "Medicine Reminder",
    title: "Medicine after Breakfast",
    description: "Take Metformin — 1 tablet daily after breakfast.",
    icon: "💊",
    date: "Today, 8:30 AM",
    dateGroup: "Today",
    source: "AI Assistant Conversation",
    confidence: 97,
    details: {
      Medicine: "Metformin",
      Dosage: "1 Tablet",
      Timing: "After Breakfast",
      Frequency: "Daily",
      Category: "Medicine Reminder",
      "Stored in": "Vector Database (Simulated)",
    },
  },
  {
    id: "3",
    category: "Appointment",
    title: "Doctor Appointment on Friday",
    description: "Dr. Patel — Cardiology check-up at 10:00 AM.",
    icon: "👨‍⚕️",
    date: "Today, 7:45 AM",
    dateGroup: "Today",
    source: "AI Assistant Conversation",
    confidence: 91,
    details: {
      Doctor: "Dr. Patel",
      Specialty: "Cardiology",
      Date: "Friday, 10:00 AM",
      Category: "Appointment",
      "Stored in": "Vector Database (Simulated)",
    },
  },
  {
    id: "4",
    category: "Social Visit",
    title: "Emily visited",
    description: "Emily Johnson (daughter) visited and brought groceries.",
    icon: "👩",
    date: "Yesterday, 4:00 PM",
    dateGroup: "Yesterday",
    source: "AI Assistant Conversation",
    confidence: 88,
    details: {
      Visitor: "Emily Johnson",
      Relationship: "Daughter",
      Activity: "Brought groceries",
      Category: "Social Visit",
      "Stored in": "Vector Database (Simulated)",
    },
  },
  {
    id: "5",
    category: "Object Location",
    title: "Glasses on bedside table",
    description: "Your glasses are on the bedside table in the bedroom.",
    icon: "👓",
    date: "Yesterday, 2:30 PM",
    dateGroup: "Yesterday",
    source: "Caregiver Response",
    confidence: 85,
    details: {
      Object: "Glasses",
      Location: "Bedside Table",
      Category: "Object Location",
      "Stored in": "Vector Database (Simulated)",
    },
  },
];

export const suggestedQuestions = [
  "Where did I keep my wallet?",
  "Remind me to take medicine after breakfast.",
  "When is my doctor appointment?",
  "Where are my glasses?",
];

export const dashboardSummary = {
  memoriesStored: 12,
  remindersToday: 3,
  caregiverStatus: "Connected",
  lastInteraction: "9:15 AM",
};

export const engineSteps = [
  {
    id: 1,
    title: "Conversation",
    description: "Patient interacts with the AI assistant via chat or voice.",
    icon: "MessageSquare",
  },
  {
    id: 2,
    title: "Memory Extraction",
    description: "NLP engine identifies key facts, objects, and intents.",
    icon: "Brain",
  },
  {
    id: 3,
    title: "Memory Classification",
    description: "Memories are categorized: location, medicine, appointment, etc.",
    icon: "Tags",
  },
  {
    id: 4,
    title: "Store in Vector Database",
    description: "Embeddings are generated and stored for semantic retrieval.",
    icon: "Database",
  },
  {
    id: 5,
    title: "Semantic Search",
    description: "Future queries are matched against stored memory vectors.",
    icon: "Search",
  },
  {
    id: 6,
    title: "Generate Response",
    description: "Context-aware answers are composed with confidence scores.",
    icon: "Sparkles",
  },
  {
    id: 7,
    title: "Notify Caregiver if Required",
    description: "Low-confidence responses trigger caregiver alerts.",
    icon: "Bell",
  },
];

export function getMemoryById(id: string): Memory | undefined {
  return memories.find((m) => m.id === id);
}

export function getMemoriesByGroup(group: string): Memory[] {
  return memories.filter((m) => m.dateGroup === group);
}
