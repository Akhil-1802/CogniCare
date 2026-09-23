import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Mic,
  Bot,
  User,
  Sparkles,
  Database,
  Bell,
  CheckCircle2,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Pill,
  AlertTriangle,
  X,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { postAssistantChat, postAssistantChatWithFile, type DetectedMedicineInfo } from "@/lib/assistant";
import { getPatientNotifications, markNotificationRead, type NotificationItem } from "@/lib/notifications";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  sources?: string[];
  checking?: boolean;
  suggest_escalation?: boolean;
  escalation_question?: string;
  escalation_handled?: boolean;
  file_name?: string;
  file_preview?: string;
  file_type?: string;
  detected_medicine?: DetectedMedicineInfo;
  ocr_summary?: string;
}

const TOOL_FRIENDLY: Record<string, string> = {
  get_today_medicines: "medicine schedule",
  get_upcoming_appointments: "appointments",
  get_patient_reminders: "reminders",
  search_patient_memories: "memories",
  search_patient_documents: "medical documents",
  create_reminder: "reminder creation",
};

const DISCLAIMER =
  "CogniCare is an assistive information and memory support system. It does not provide medical diagnosis, treatment, or professional medical advice.";

export default function AIAssistant() {
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your CogniCare assistant. You can ask me about your medicines, appointments, or belongings. You can also upload a photo of your medicine or prescription, and I will check your medical records to verify it.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      sources: [],
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [status, setStatus] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [answeredAlert, setAnsweredAlert] = useState<NotificationItem | null>(null);

  // File upload state
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    // Check if caretaker has answered any questions
    const checkAnswers = async () => {
      try {
        const notifs = await getPatientNotifications(10);
        const unreadAnswer = notifs.find((n) => n.status === "answered" && !n.patient_read);
        if (unreadAnswer) {
          setAnsweredAlert(unreadAnswer);
        }
      } catch {
        // Not logged in as patient or network error
      }
    };
    checkAnswers();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAttachedFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setAttachedPreview(url);
    } else {
      setAttachedPreview(null);
    }
    e.target.value = "";
  };

  const removeAttachedFile = () => {
    if (attachedPreview) {
      URL.revokeObjectURL(attachedPreview);
    }
    setAttachedFile(null);
    setAttachedPreview(null);
  };

  const sendMessage = async (text: string) => {
    if ((!text.trim() && !attachedFile) || isTyping) return;
    const clean = text.trim() || (attachedFile ? "Can you check this medicine for me?" : "");

    const fileToUpload = attachedFile;
    const previewToKeep = attachedPreview;

    // Reset attachments immediately for UX responsiveness
    setAttachedFile(null);
    setAttachedPreview(null);

    const userMsg: UiMessage = {
      id: Date.now().toString(),
      role: "user",
      content: clean,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      file_name: fileToUpload?.name,
      file_preview: previewToKeep || undefined,
      file_type: fileToUpload?.type,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    if (fileToUpload) {
      setStatus("Scanning document with high-speed OCR & cross-referencing records...");
    } else {
      setStatus("Thinking...");
    }

    try {
      let res;
      if (fileToUpload) {
        res = await postAssistantChatWithFile(fileToUpload, clean, conversationId);
      } else {
        res = await postAssistantChat(clean, conversationId);
      }

      setConversationId(res.conversation_id);
      const tools = (res.tools_used || []).filter((t) => t !== "none");
      const friendly = tools.map((t) => TOOL_FRIENDLY[t] || "records");

      const shouldEscalate =
        Boolean(res.suggest_caretaker_escalation) ||
        (res.detected_medicine && res.detected_medicine.status !== "VERIFIED") ||
        res.response.toLowerCase().includes("ask your caretaker") ||
        res.response.toLowerCase().includes("ask the caretaker");

      const assistantMsg: UiMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        sources: res.sources || [],
        suggest_escalation: shouldEscalate,
        escalation_question: res.escalation_question || clean,
        detected_medicine: res.detected_medicine,
        ocr_summary: res.ocr_summary,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (res.detected_medicine) {
        const matchStatus = res.detected_medicine.status === "VERIFIED" ? "Verified in records" : "Unverified in records";
        setStatus(`OCR: ${res.detected_medicine.detected_name} (${matchStatus})`);
      } else if (res.rate_limited) {
        setStatus("Answered in offline mode (AI quota busy) — full answers return shortly.");
      } else {
        setStatus(friendly.length ? `Checked: ${friendly.join(", ")}` : "");
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      const content =
        status === 401
          ? "Your session expired. Please log in again, then try your message."
          : detail && status === 500
          ? `Something went wrong on the server (${detail.slice(0, 160)}). Please try again.`
          : "I'm having trouble right now. Please try again in a moment.";
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setStatus("");
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmEscalate = async (msgId?: string, customQuestion?: string) => {
    if (msgId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, escalation_handled: true } : m))
      );
    }
    const q = customQuestion ? `Yes, please ask my caretaker about: ${customQuestion}` : "Yes, please ask my caretaker.";
    await sendMessage(q);
  };

  const handleDeclineEscalate = async (msgId?: string) => {
    if (msgId) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, escalation_handled: true } : m))
      );
    }
    await sendMessage("No, thank you.");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col pb-20 lg:pb-0 lg:h-[calc(100vh-3rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Assistant</h1>
            <p className="text-sm text-slate-500">Cognitive Memory & Medicine OCR</p>
          </div>
        </div>
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </Badge>
      </div>

      {answeredAlert && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3 flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50/90 p-3 text-xs text-emerald-900 shadow-sm"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-emerald-950">
                Caretaker replied to: &quot;{answeredAlert.question}&quot;
              </p>
              <p className="mt-0.5 text-emerald-800 font-medium">
                &quot;{answeredAlert.response}&quot;
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                <Database className="h-3 w-3" />
                Saved to your CogniCare Memory Bank
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              markNotificationRead(answeredAlert.id);
              setAnsweredAlert(null);
            }}
            className="text-emerald-700 hover:text-emerald-950 font-bold ml-2 text-sm p-1"
            title="Dismiss notification"
          >
            ✕
          </button>
        </motion.div>
      )}

      <p className="mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs text-amber-800">
        {DISCLAIMER}
      </p>

      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[var(--shadow-card)]">
        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        msg.role === "user" ? "bg-sky-100" : "bg-gradient-to-br from-sky-500 to-blue-600"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="h-4 w-4 text-sky-600" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className={`max-w-[85%] ${msg.role === "user" ? "text-right" : ""}`}>
                      {/* Attached File Preview inside User Bubble */}
                      {msg.role === "user" && msg.file_name && (
                        <div className="mb-2 inline-flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-200 p-2 text-xs text-sky-900 shadow-xs">
                          {msg.file_preview ? (
                            <img
                              src={msg.file_preview}
                              alt="Upload preview"
                              className="h-12 w-12 rounded-lg object-cover border border-sky-100"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                              <FileText className="h-5 w-5" />
                            </div>
                          )}
                          <div className="text-left">
                            <span className="block font-medium truncate max-w-[180px]">{msg.file_name}</span>
                            <span className="text-[10px] text-sky-600 flex items-center gap-1">
                              <ScanLine className="h-3 w-3" /> OCR Scanned
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Main Message Bubble */}
                      <div
                        className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-sky-600 text-white rounded-tr-sm"
                            : "bg-slate-50 text-slate-800 rounded-tl-sm text-left"
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* OCR Medicine Verification Card */}
                      {msg.detected_medicine && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`mt-2.5 rounded-xl border p-3.5 text-left shadow-xs ${
                            msg.detected_medicine.status === "VERIFIED"
                              ? "border-emerald-200 bg-emerald-50/80"
                              : "border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/60"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div
                                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                                  msg.detected_medicine.status === "VERIFIED"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {msg.detected_medicine.status === "VERIFIED" ? (
                                  <Pill className="h-4 w-4" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-900">
                                  {msg.detected_medicine.detected_name}
                                </span>
                                {msg.detected_medicine.detected_dosage && (
                                  <span className="ml-1 text-[11px] text-slate-500">
                                    • {msg.detected_medicine.detected_dosage}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Badge
                              variant={msg.detected_medicine.status === "VERIFIED" ? "success" : "secondary"}
                              className={`text-[10px] ${
                                msg.detected_medicine.status === "VERIFIED"
                                  ? "bg-emerald-600 text-white"
                                  : "bg-amber-100 text-amber-800 border-amber-300"
                              }`}
                            >
                              {msg.detected_medicine.status === "VERIFIED"
                                ? "Verified in Records"
                                : "Not in Medical Records"}
                            </Badge>
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed">
                            {msg.detected_medicine.advisory}
                          </p>

                          {msg.detected_medicine.matched_record && (
                            <div className="mt-2 rounded-lg bg-white/80 border border-emerald-100 p-2 text-[11px] text-emerald-900">
                              <span className="font-semibold">Prescription match: </span>
                              {msg.detected_medicine.matched_record.content || msg.detected_medicine.matched_record.name}
                            </div>
                          )}
                        </motion.div>
                      )}

                      {/* Escalation interactive action card */}
                      {msg.suggest_escalation && !msg.escalation_handled && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-2.5 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-orange-50/50 p-3.5 text-left shadow-sm"
                        >
                          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 mb-1">
                            <Bell className="h-4 w-4 text-amber-600 animate-bounce [animation-duration:2s]" />
                            <span>Notify Caretaker to Verify?</span>
                          </div>
                          <p className="text-xs text-amber-800 mb-3 leading-relaxed">
                            CogniCare can send an inquiry directly to your caretaker. Their answer will be delivered to you and saved to your medical memory.
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleConfirmEscalate(msg.id, msg.escalation_question)}
                              className="h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg shadow-sm"
                            >
                              <Bell className="h-3.5 w-3.5" />
                              Yes, Ask Caretaker
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeclineEscalate(msg.id)}
                              className="h-8 border-amber-200 text-amber-800 hover:bg-amber-100/60 text-xs rounded-lg"
                            >
                              No, thank you
                            </Button>
                          </div>
                        </motion.div>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-sky-600">
                          <Database className="h-3 w-3" />
                          Source: {msg.sources.join(", ")}
                        </div>
                      )}
                      <p className="mt-1 text-[11px] text-slate-400 px-1">{msg.timestamp}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 rounded-tl-sm">
                  <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <ScanLine className="h-3.5 w-3.5 text-sky-600 animate-spin" />
                    {status}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0ms]" />
                    <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                    <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          <div className="border-t border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-2 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-xs font-medium text-slate-500">Quick Prompts</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {[
                "What medicine do I take today?",
                "Can I take my blood pressure pills?",
                "Check my prescription records",
                "Where is my wallet?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Attached file preview bar */}
          {attachedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-sky-100 bg-sky-50/70 px-4 py-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {attachedPreview ? (
                  <img
                    src={attachedPreview}
                    alt="attachment"
                    className="h-9 w-9 rounded-lg object-cover border border-sky-200"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                    <FileText className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                    {attachedFile.name}
                  </p>
                  <p className="text-[10px] text-sky-700 font-medium">
                    Ready for OCR analysis & medical record check
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={removeAttachedFile}
                className="h-7 w-7 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-sky-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </motion.div>
          )}

          {/* Input Box Toolbar */}
          <div className="border-t border-slate-100 p-4">
            <input
              type="file"
              ref={fileInputRef}
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 rounded-xl hover:bg-sky-50 hover:text-sky-700 border-slate-200"
                title="Attach medicine photo or prescription PDF"
              >
                <Paperclip className="h-4 w-4 text-sky-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 rounded-xl hidden sm:flex"
                title="Voice input (UI only)"
              >
                <Mic className="h-4 w-4 text-sky-600" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder={
                  attachedFile
                    ? "Add a question about this medicine (e.g., 'Should I take this?') or press Send..."
                    : "Ask about medicines, doctors, or attach a photo of your pill..."
                }
                className="min-h-[44px] max-h-32 flex-1 text-sm resize-none"
                rows={1}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={(!input.trim() && !attachedFile) || isTyping}
                size="icon"
                className="shrink-0 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
