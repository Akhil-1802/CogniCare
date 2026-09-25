import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Search,
  AlertTriangle,
  User,
  Bot,
  CheckCircle2,
  ArrowDown,
  RefreshCw,
  Clock,
  Database,
  Play,
  Heart,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getPatientNotifications,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/notifications";

type FlowStep =
  | "idle"
  | "question"
  | "searching"
  | "not-found"
  | "notifying"
  | "waiting"
  | "responded"
  | "updated";

export default function NotificationFlow() {
  const [tab, setTab] = useState<"live" | "demo">("live");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<FlowStep>("idle");

  const fetchLiveNotifications = async () => {
    setLoading(true);
    try {
      const data = await getPatientNotifications(50);
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, patient_read: true } : n))
      );
    } catch {
      // Ignored
    }
  };

  const startDemo = () => {
    setStep("question");
    setTimeout(() => setStep("searching"), 1500);
    setTimeout(() => setStep("not-found"), 3500);
    setTimeout(() => setStep("notifying"), 5000);
    setTimeout(() => setStep("waiting"), 6500);
    setTimeout(() => setStep("responded"), 9000);
    setTimeout(() => setStep("updated"), 11000);
  };

  const reset = () => setStep("idle");

  const answeredList = notifications.filter((n) => n.status === "answered");
  const pendingList = notifications.filter((n) => n.status === "pending");

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
              <h1 className="text-2xl font-bold text-slate-900">Notifications Center</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Updates from your Caretaker and memory escalations
              </p>
            </div>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setTab("live")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === "live"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              My Notifications
              {answeredList.some((n) => !n.patient_read) && (
                <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setTab("demo")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                tab === "demo"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              How It Works Demo
            </button>
          </div>

          {tab === "live" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={fetchLiveNotifications}
              className="gap-1.5 h-8 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : step === "idle" ? (
            <Button onClick={startDemo} size="sm" className="gap-1.5 h-8 text-xs">
              <Play className="h-3.5 w-3.5" />
              Start Demo
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={reset} className="gap-1.5 h-8 text-xs">
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Live Notifications Tab */}
      {tab === "live" && (
        <div className="space-y-6">
          {/* Section 1: Caretaker Answers Received */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Answers from Caretaker ({answeredList.length})
              </h2>
            </div>

            {loading && notifications.length === 0 ? (
              <div className="py-10 text-center text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-sky-600" />
                <p className="text-xs">Checking notifications...</p>
              </div>
            ) : answeredList.length === 0 ? (
              <Card className="border-dashed border border-slate-200 bg-white">
                <CardContent className="py-8 text-center text-slate-400">
                  <Heart className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-medium text-slate-600">No caretaker responses yet</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    When your caretaker answers questions you asked the AI assistant, their responses will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {answeredList.map((notif) => (
                  <motion.div
                    key={notif.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card
                      className={`overflow-hidden transition-shadow ${
                        !notif.patient_read
                          ? "border-emerald-300 bg-gradient-to-br from-emerald-50/50 via-white to-white ring-1 ring-emerald-200"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <CardContent className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-900">
                                {notif.metadata?.caretaker_name || "CareTaker"} replied
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <Clock className="h-3 w-3" />
                                <span>
                                  {notif.answered_at
                                    ? new Date(notif.answered_at).toLocaleDateString([], {
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "Recently"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="success" className="text-[11px] gap-1">
                              <Database className="h-3 w-3" />
                              Stored in Memory
                            </Badge>
                            {!notif.patient_read && (
                              <button
                                onClick={() => handleMarkAsRead(notif.id)}
                                className="text-[11px] text-sky-600 hover:text-sky-800 font-medium px-2 py-0.5 rounded hover:bg-sky-50"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Question */}
                        <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
                          <span className="font-semibold text-slate-700">Your Question: </span>
                          &quot;{notif.question}&quot;
                        </div>

                        {/* Answer */}
                        <div className="rounded-xl bg-emerald-50/80 p-3.5 text-slate-900 text-sm font-medium border border-emerald-100 leading-relaxed">
                          &quot;{notif.response}&quot;
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Inquiries Waiting for Caretaker */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Awaiting Caretaker Response ({pendingList.length})
            </h2>

            {pendingList.length === 0 ? (
              <p className="text-xs text-slate-400 pl-1">No questions currently waiting for Caretaker response.</p>
            ) : (
              <div className="grid gap-3">
                {pendingList.map((notif) => (
                  <Card key={notif.id} className="border-amber-200 bg-amber-50/30">
                    <CardContent className="p-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">
                            &quot;{notif.question}&quot;
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Sent to your caretaker • {new Date(notif.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="warning" className="gap-1 shrink-0 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Waiting for Reply
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Demo Simulation Tab */}
      {tab === "demo" && (
        <div className="space-y-4">
          {step === "idle" && (
            <Card className="border-dashed border-2 border-sky-200 bg-sky-50/30">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 mb-4">
                  <Bell className="h-8 w-8 text-sky-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  CareTaker Escalation Architecture Demo
                </h3>
                <p className="mt-2 max-w-md text-sm text-slate-500">
                  Click &quot;Start Demo&quot; to see how CogniCare identifies missing database information, asks your permission, notifies your CareTaker, and updates your memory database upon response.
                </p>
                <Button onClick={startDemo} className="mt-4 gap-2">
                  <Play className="h-4 w-4" />
                  Start Demo Simulation
                </Button>
              </CardContent>
            </Card>
          )}

          <AnimatePresence mode="wait">
            {step !== "idle" && (
              <motion.div
                key="flow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-4"
              >
                {/* Step 1: Patient Question */}
                {["question", "searching", "not-found", "notifying", "waiting", "responded", "updated"].includes(step) && (
                  <FlowStepCard delay={0}>
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                        <User className="h-4 w-4 text-sky-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">Patient asks</p>
                        <p className="rounded-2xl bg-sky-600 text-white px-4 py-2 text-sm inline-block rounded-tr-sm">
                          &quot;Where is my wallet?&quot;
                        </p>
                      </div>
                    </div>
                  </FlowStepCard>
                )}

                {/* Step 2: Searching */}
                {["searching", "not-found", "notifying", "waiting", "responded", "updated"].includes(step) && (
                  <FlowStepCard delay={0.1}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium text-slate-500 mb-1">AI Assistant</p>
                        {step === "searching" ? (
                          <div className="flex items-center gap-2 text-sm text-sky-600">
                            <Search className="h-4 w-4 animate-pulse" />
                            Searching Memory & Database...
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-slate-700">
                              &quot;I don&apos;t have that information in your records. Would you like me to ask your caretaker regarding this?&quot;
                            </p>
                            <Badge variant="warning" className="gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Not Present in DB — Escalation Offered
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  </FlowStepCard>
                )}

                <Connector visible={["notifying", "waiting", "responded", "updated"].includes(step)} />

                {/* Step 3: Notification Sent */}
                {["notifying", "waiting", "responded", "updated"].includes(step) && (
                  <FlowStepCard delay={0.2} highlight>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                        <Bell className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          Patient said &quot;Yes&quot; → Notification Sent to CareTaker
                        </p>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">CareTaker</span>
                            <span className="font-medium">{careTaker.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Question</span>
                            <span className="font-medium">&quot;Where is my wallet?&quot;</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Status</span>
                            <Badge variant={step === "waiting" ? "warning" : "success"}>
                              {step === "waiting" ? "Waiting for Response" : "Responded"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </FlowStepCard>
                )}

                <Connector visible={["responded", "updated"].includes(step)} />

                {/* Step 4: CareTaker Response */}
                {["responded", "updated"].includes(step) && (
                  <FlowStepCard delay={0.3}>
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                        <User className="h-4 w-4 text-rose-600" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-slate-500 mb-1">
                          CareTaker replied
                        </p>
                        <p className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm text-slate-800">
                          &quot;Your wallet is on the dining table next to the keys.&quot;
                        </p>
                      </div>
                    </div>
                  </FlowStepCard>
                )}

                <Connector visible={step === "updated"} />

                {/* Step 5: Memory Updated */}
                {step === "updated" && (
                  <FlowStepCard delay={0.4} success>
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      <div>
                        <p className="font-semibold text-emerald-800">
                          Memory Stored in Database & Patient Notified
                        </p>
                        <p className="text-sm text-emerald-600 mt-0.5">
                          Wallet Location → Stored in PostgreSQL & ChromaDB Vector Index
                        </p>
                      </div>
                    </div>
                  </FlowStepCard>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function FlowStepCard({
  children,
  delay = 0,
  highlight = false,
  success = false,
}: {
  children: React.ReactNode;
  delay?: number;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
    >
      <Card
        className={
          highlight
            ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-[var(--shadow-elevated)]"
            : success
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
              : ""
        }
      >
        <CardContent className="p-5">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function Connector({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      className="flex justify-center py-1"
    >
      <ArrowDown className="h-5 w-5 text-sky-300" />
    </motion.div>
  );
}
