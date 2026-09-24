import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, MessageSquare, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import {
  getAiActivity,
  getCaretakerConversationDetail,
  validateMemory,
  type AiActivity,
  type ConversationMessage,
} from "@/lib/assistant";

export default function CaretakerAiActivity() {
  const { patients } = useAuth();
  const [patientId, setPatientId] = useState("");
  const [activity, setActivity] = useState<AiActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [openConv, setOpenConv] = useState<string | null>(null);
  const [convMessages, setConvMessages] = useState<ConversationMessage[]>([]);

  useEffect(() => {
    if (!patientId && patients.length > 0) setPatientId(patients[0].id);
  }, [patients, patientId]);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    getAiActivity(patientId)
      .then(setActivity)
      .catch(() => setActivity(null))
      .finally(() => setLoading(false));
  }, [patientId]);

  const openConversation = async (id: string) => {
    if (openConv === id) {
      setOpenConv(null);
      return;
    }
    setOpenConv(id);
    try {
      const d = await getCaretakerConversationDetail(patientId, id);
      setConvMessages(d.messages);
    } catch {
      setConvMessages([]);
    }
  };

  const onValidate = async (mid: string, status: "ACTIVE" | "REJECTED") => {
    try {
      await validateMemory(mid, status);
      const fresh = await getAiActivity(patientId);
      setActivity(fresh);
    } catch {
      alert("Validation failed");
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20 lg:pb-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">AI Activity</h1>
        <p className="mt-1 text-slate-500">Recent patient AI conversations, summaries and memories.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <label className="text-sm font-medium text-slate-700">Patient</label>
          <select
            className="mt-2 flex h-10 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.id})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-500">Loading AI activity...</p>
      ) : !activity ? (
        <p className="text-sm text-slate-500">No activity found.</p>
      ) : (
        <>
          <Card className="border-0 bg-gradient-to-br from-sky-600 to-blue-700 text-white">
            <CardContent className="p-6">
              <h2 className="font-semibold">Today&apos;s Summary — {activity.date}</h2>
              <p className="mt-2 text-sm text-sky-100">
                {activity.daily_summary?.summary || "No AI activity recorded yet today."}
              </p>
              {(activity.daily_summary?.important_events || []).length > 0 && (
                <ul className="mt-3 space-y-1 text-sm text-sky-50">
                  {(activity.daily_summary?.important_events || []).map((e, i) => (
                    <li key={i}>• {e}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <MessageSquare className="h-4 w-4 text-sky-600" /> Recent Conversations
              </h3>
              {activity.recent_conversations.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No recent conversations.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {activity.recent_conversations.map((c) => (
                    <div key={c.id} className="rounded-xl border border-slate-200">
                      <button
                        onClick={() => openConversation(c.id)}
                        className="flex w-full items-center justify-between p-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">{c.preview || "Conversation"}</p>
                          <p className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </button>
                      {openConv === c.id && (
                        <div className="space-y-2 border-t border-slate-100 p-3">
                          {convMessages.map((m) => (
                            <div key={m.id} className="rounded-lg bg-slate-50 p-2.5 text-sm">
                              <p className="text-[11px] font-semibold uppercase text-slate-400">
                                {m.sender_type} · {new Date(m.created_at).toLocaleTimeString()}
                              </p>
                              <p className="mt-1 text-slate-800">{m.content}</p>
                              {m.tools_used && m.tools_used.length > 0 && (
                                <p className="mt-1 text-xs text-sky-600">Used: {m.tools_used.join(", ")}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="flex items-center gap-2 font-semibold text-slate-900">
                <Brain className="h-4 w-4 text-violet-600" /> Pending Memory Validation
              </h3>
              {(activity.pending_validation || []).length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No memories awaiting review.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {activity.pending_validation.map((m) => (
                    <div key={m.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900">{m.title}</p>
                          <Badge className="bg-amber-100 text-amber-800">{m.memory_type}</Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          {m.total_score !== undefined && (
                            <span className="rounded-md bg-white px-2 py-0.5 shadow-sm text-slate-700 border border-amber-200">
                              Score: {Math.round(m.total_score)}/100
                            </span>
                          )}
                          <span className="rounded-md bg-white px-2 py-0.5 shadow-sm text-slate-700 border border-amber-200">
                            Confidence: {Math.round((m.confidence || 0) * 100)}%
                          </span>
                          {m.retention_days && (
                            <span className="rounded-md bg-white px-2 py-0.5 shadow-sm text-slate-700 border border-amber-200">
                              Retention: {m.retention_days}d
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{m.content}</p>
                      {m.metadata?.reason && (
                        <p className="mt-1 text-xs text-amber-800 italic bg-amber-100/60 p-1.5 rounded">
                          Review note: {m.metadata.reason}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="success" onClick={() => onValidate(m.id, "ACTIVE")}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onValidate(m.id, "REJECTED")}>
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <h3 className="font-semibold text-slate-900">Important Memories</h3>
              {(activity.important_memories || []).length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No stored memories yet.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {activity.important_memories.map((m) => (
                    <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-sm font-medium text-slate-900">{m.title}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{m.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
