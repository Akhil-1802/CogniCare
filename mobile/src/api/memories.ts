import api from "./client";
import type { Memory } from "../types";

export function formatConfidence(conf?: number): string {
  if (conf === undefined || conf === null) return "95%";
  const val = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  return `${val}%`;
}

export function getDateGroup(isoStr?: string): "Today" | "Yesterday" | "Earlier" {
  if (!isoStr) return "Today";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return "Today";
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return "Earlier";
  } catch {
    return "Today";
  }
}

export function formatMemoryDate(isoStr?: string): string {
  if (!isoStr) return "Recently recorded";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoStr.slice(0, 10);
  }
}

export const MemoriesApi = {
  async listMemories(status = "ACTIVE", patientId?: string): Promise<Memory[]> {
    const res = await api.get<Memory[]>("/api/v1/memories", {
      params: {
        status,
        ...(patientId ? { patient_id: patientId } : {}),
      },
    });
    return res.data;
  },

  async searchMemories(query: string): Promise<Memory[]> {
    const res = await api.get<Memory[]>("/api/v1/memories/search", {
      params: { q: query },
    });
    return res.data;
  },

  async getMemoryDetail(memoryId: string): Promise<Memory> {
    const res = await api.get<Memory>(`/api/v1/memories/${memoryId}`);
    return res.data;
  },

  async getMemoryScore(memoryId: string) {
    const res = await api.get(`/api/v1/memories/${memoryId}/score`);
    return res.data;
  },

  async updateMemory(
    memoryId: string,
    data: { title?: string; content?: string; reconfirm?: boolean }
  ) {
    const res = await api.patch(`/api/v1/memories/${memoryId}`, data);
    return res.data;
  },

  async deleteMemory(memoryId: string) {
    const res = await api.delete(`/api/v1/memories/${memoryId}`);
    return res.data;
  },

  async listPendingMemories(patientId?: string): Promise<Memory[]> {
    const res = await api.get<Memory[]>("/api/v1/memories/pending", {
      params: patientId ? { patient_id: patientId } : {},
    });
    return res.data;
  },
};
