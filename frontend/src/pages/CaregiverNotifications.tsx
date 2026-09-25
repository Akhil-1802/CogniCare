import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCircle2,
  Clock,
  Send,
  Database,
  User,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  getCaretakerNotifications,
  respondToNotification,
  broadcastNotificationCount,
  type NotificationItem,
} from "@/lib/notifications";

export default function CaregiverNotifications() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "answered" | "all">("pending");
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadNotifications = async () => {
    try {
      const data = await getCaretakerNotifications(50);
      setNotifications(data);
      const pendingCount = data.filter((n) => n.status === "pending").length;
      broadcastNotificationCount(pendingCount);
    } catch {
      // If error or unauthenticated, keep empty
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadNotifications();
    const interval = setInterval(loadNotifications, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleReplyChange = (id: string, text: string) => {
    setReplyText((prev) => ({ ...prev, [id]: text }));
  };

  const handleSendResponse = async (notif: NotificationItem) => {
    const text = (replyText[notif.id] || "").trim();
    if (!text || submittingId) return;

    setSubmittingId(notif.id);
    try {
      await respondToNotification(notif.id, text, notif.category);
      setSuccessMsg(`✓ Reply sent to ${notif.metadata?.patient_name || "patient"} and saved to long-term memory!`);
      setTimeout(() => setSuccessMsg(null), 4000);

      // Update state locally
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notif.id
            ? {
                ...n,
                status: "answered",
                response: text,
                answered_at: new Date().toISOString(),
                patient_read: false,
              }
            : n
        )
      );
      const remainingPending = notifications.filter(
        (n) => n.id !== notif.id && n.status === "pending"
      ).length;
      broadcastNotificationCount(remainingPending);
      setReplyText((prev) => ({ ...prev, [notif.id]: "" }));
    } catch {
      alert("Failed to send response. Please try again.");
    } finally {
      setSubmittingId(null);
    }
  };

  const pendingItems = notifications.filter((n) => n.status === "pending");
  const answeredItems = notifications.filter((n) => n.status === "answered");

  const displayedItems = notifications.filter((n) => {
    const matchesTab =
      activeTab === "pending"
        ? n.status === "pending"
        : activeTab === "answered"
          ? n.status === "answered"
          : true;

    const matchesSearch =
      !searchTerm.trim() ||
      n.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.metadata?.patient_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (n.response || "").toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesSearch;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm text-white">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Patient Inquiries</h1>
              <p className="text-sm text-slate-500">
                Questions escalated from AI Assistant that require Caretaker input
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadNotifications} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 shadow-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "pending"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Needs Reply</span>
            {pendingItems.length > 0 && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === "pending" ? "bg-white text-amber-700" : "bg-amber-100 text-amber-700"
              }`}>
                {pendingItems.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("answered")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "answered"
                ? "bg-sky-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Answered History</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              activeTab === "answered" ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600"
            }`}>
              {answeredItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("all")}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
              activeTab === "all"
                ? "bg-slate-800 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            All
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions or patients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 rounded-xl border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Notifications list */}
      <div className="space-y-4">
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin mb-3 text-sky-600" />
            <p className="text-sm">Loading patient inquiries...</p>
          </div>
        ) : displayedItems.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 mb-3 text-slate-400">
                <HelpCircle className="h-7 w-7" />
              </div>
              <h3 className="font-semibold text-slate-800 text-base">
                {activeTab === "pending"
                  ? "No pending patient inquiries"
                  : "No notifications found"}
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                {activeTab === "pending"
                  ? "When your patients ask the AI questions that aren't in the database (e.g. wallet location, appointment specifics), they will appear here for you to answer."
                  : "Try switching tabs or resetting your search filter."}
              </p>
            </CardContent>
          </Card>
        ) : (
          displayedItems.map((notif) => {
            const isPending = notif.status === "pending";
            const patientName = notif.metadata?.patient_name || "Patient";
            const currentReply = replyText[notif.id] || "";

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`overflow-hidden transition-all duration-200 shadow-sm ${
                    isPending
                      ? "border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-white ring-1 ring-amber-200/60"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <CardContent className="p-5 sm:p-6 space-y-4">
                    {/* Top row: Patient info + Status Badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 text-white font-bold text-xs shadow-sm">
                          <User className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-sm">{patientName}</span>
                            <span className="text-[11px] text-slate-400">•</span>
                            <span className="text-[11px] text-slate-500">{notif.category || "General"}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <Clock className="h-3 w-3" />
                            <span>
                              {new Date(notif.created_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={isPending ? "warning" : "success"}
                        className="gap-1 shrink-0 text-xs px-2.5 py-1"
                      >
                        {isPending ? (
                          <>
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            Awaiting Reply
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Answered & Stored
                          </>
                        )}
                      </Badge>
                    </div>

                    {/* Question Bubble */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        Question asked by {patientName} (Missing from DB):
                      </p>
                      <p className="text-slate-900 font-medium text-sm leading-relaxed">
                        &quot;{notif.question}&quot;
                      </p>
                    </div>

                    {/* If Answered: show the caretaker's answer */}
                    {!isPending && notif.response && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2">
                        <p className="text-xs font-semibold text-emerald-900 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Your Stored Response:
                        </p>
                        <p className="text-slate-800 text-sm leading-relaxed bg-white rounded-lg p-3 border border-emerald-100">
                          {notif.response}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-emerald-700">
                          <Database className="h-3 w-3" />
                          <span>Saved in patient memories vector database (confidence 100%)</span>
                        </div>
                      </div>
                    )}

                    {/* If Pending: Response form */}
                    {isPending && (
                      <div className="space-y-3 pt-1 border-t border-slate-100">
                        <label className="text-xs font-medium text-slate-700 block">
                          Your Answer for {patientName}:
                        </label>
                        <Textarea
                          value={currentReply}
                          onChange={(e) => handleReplyChange(notif.id, e.target.value)}
                          placeholder={`E.g., "Your wallet is on the dining table next to the keys." or appointment details...`}
                          className="min-h-[80px] text-sm focus:border-amber-500"
                        />
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-[11px] text-slate-500 flex items-center gap-1">
                            <Database className="h-3 w-3 text-sky-600" />
                            This answer will be saved to memory so AI can answer it next time.
                          </p>
                          <Button
                            onClick={() => handleSendResponse(notif)}
                            disabled={!currentReply.trim() || submittingId === notif.id}
                            className="gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white text-xs font-semibold h-9 rounded-xl shadow-sm sm:self-end"
                          >
                            <Send className="h-3.5 w-3.5" />
                            {submittingId === notif.id ? "Saving & Sending..." : "Send Response & Save to Memory"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
