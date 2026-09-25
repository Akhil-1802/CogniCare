import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Upload,
  Clock,
  Bell,
  Users,
  Brain,
  Sparkles,
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Circle,
  Calendar,
  Pill,
  Activity,
  Plus,
  Phone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { fetchPatientReminders, updateReminder, todayISO } from "@/lib/reminders";
import api from "@/lib/api";
import type { Reminder, CareTaker } from "@/types";

interface LiveMemory {
  id: string;
  title: string;
  content?: string;
  memory_type?: string;
  confidence?: number;
  importance?: string;
  created_at?: string;
  total_score?: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getMemoryIcon(type?: string): string {
  switch (type?.toUpperCase()) {
    case "OBJECT_LOCATION":
      return "📍";
    case "MEDICATION":
      return "💊";
    case "APPOINTMENT":
      return "📅";
    case "IMPORTANT_FACT":
      return "🧠";
    case "PREFERENCE":
      return "⭐";
    case "SOCIAL_VISIT":
      return "👥";
    default:
      return "💭";
  }
}

function formatMemoryDate(isoStr?: string): string {
  if (!isoStr) return "Recently recorded";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return isoStr.slice(0, 10);
  }
}

function formatConfidence(conf?: number): string {
  if (conf === undefined || conf === null) return "95%";
  const val = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  return `${val}%`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [todayRoutine, setTodayRoutine] = useState<Reminder[]>([]);
  const [loadingRoutine, setLoadingRoutine] = useState(true);
  const [memories, setMemories] = useState<LiveMemory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(true);
  const [caretakerInfo, setCaretakerInfo] = useState<CareTaker | null>(() => {
    if (user && "caretaker" in user && user.caretaker) {
      return user.caretaker as CareTaker;
    }
    return null;
  });

  const displayName = user && "name" in user && user.name ? user.name : "Patient";
  const patientId = user?.id || "";

  useEffect(() => {
    if (user && "caretaker" in user && user.caretaker) {
      setCaretakerInfo(user.caretaker as CareTaker);
    } else if (patientId) {
      api
        .get("/patient-auth/caretaker")
        .then((res) => {
          if (res.data) setCaretakerInfo(res.data);
          else setCaretakerInfo(null);
        })
        .catch(() => {
          setCaretakerInfo(null);
        });
    }
  }, [user, patientId]);

  const loadTodayRoutine = async () => {
    if (!patientId) return;
    try {
      const data = await fetchPatientReminders(patientId, todayISO());
      setTodayRoutine(data);
    } catch {
      setTodayRoutine([]);
    } finally {
      setLoadingRoutine(false);
    }
  };

  const loadMemories = async () => {
    if (!patientId) {
      setLoadingMemories(false);
      return;
    }
    try {
      const res = await api.get("/api/v1/memories");
      if (Array.isArray(res.data)) {
        setMemories(res.data);
      } else {
        setMemories([]);
      }
    } catch {
      setMemories([]);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadTodayRoutine();
      loadMemories();
    } else {
      setLoadingRoutine(false);
      setLoadingMemories(false);
    }
  }, [patientId]);

  const handleToggleDone = async (reminder: Reminder) => {
    const newStatus = !reminder.is_done;
    try {
      await updateReminder(reminder.id, { is_done: newStatus });
      setTodayRoutine((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, is_done: newStatus } : r
        )
      );
    } catch (e) {
      console.error("Failed to update status", e);
    }
  };

  const routineCompleted = todayRoutine.filter((r) => r.is_done).length;
  const routineTotal = todayRoutine.length;

  const quickActions = [
    {
      title: "Daily Routine",
      description: "Appointments & daily schedule",
      icon: CalendarCheck,
      path: "/routine",
      color: "from-indigo-500 to-blue-600",
    },
    {
      title: "AI Assistant",
      description: "Chat and ask about routine",
      icon: MessageSquare,
      path: "/assistant",
      color: "from-sky-500 to-blue-600",
    },
    {
      title: "Upload Medicine",
      description: "Scan prescriptions",
      icon: Upload,
      path: "/upload",
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Memory Timeline",
      description: "Browse stored memories",
      icon: Clock,
      path: "/timeline",
      color: "from-violet-500 to-purple-600",
    },
    {
      title: "Notifications",
      description: "CareTaker alert flow",
      icon: Bell,
      path: "/notifications",
      color: "from-amber-500 to-orange-600",
    },
    {
      title: caretakerInfo?.name || "Connected CareTaker",
      description: caretakerInfo
        ? `${caretakerInfo.relationship || "CareTaker"} • ${caretakerInfo.status || "Online"}`
        : "View caregiver details",
      icon: Users,
      path: "/caregiver",
      color: "from-rose-500 to-pink-600",
    },
  ];

  const formatDisplayTime = (timeStr: string) => {
    try {
      const [h, m] = timeStr.split(":");
      const d = new Date();
      d.setHours(parseInt(h, 10), parseInt(m, 10));
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } catch {
      return timeStr.slice(0, 5);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-20 lg:pb-8"
    >
      {/* Welcome */}
      <motion.div variants={item}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-600">{getGreeting()}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Welcome back, {displayName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-slate-500">
              Your cognitive memory assistant is ready to help you with your routine today.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/routine"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              <CalendarCheck className="h-4 w-4" />
              View Daily Routine
            </Link>
            <Link
              to="/engine"
              className="inline-flex items-center gap-2 rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
            >
              <Brain className="h-4 w-4" />
              Memory Engine
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Today's Summary */}
      <motion.div variants={item}>
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-sky-600 to-blue-700 text-white shadow-[var(--shadow-elevated)]">
          <CardContent className="p-6 sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-sky-200" />
                  <h2 className="text-lg font-semibold">Today&apos;s Summary</h2>
                </div>
                <p className="mt-2 text-sky-100 text-sm">
                  {routineTotal > 0
                    ? `${routineCompleted} of ${routineTotal} routine tasks completed today`
                    : "No routine tasks scheduled yet for today"}
                </p>
              </div>
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/20">
                {caretakerInfo?.name
                  ? `${caretakerInfo.name} (${caretakerInfo.status || "Active"})`
                  : "No CareTaker"}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{loadingMemories ? "—" : memories.length}</p>
                <p className="text-xs text-sky-100 mt-1">Memories Stored</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{routineTotal}</p>
                <p className="text-xs text-sky-100 mt-1">Routine Today</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{routineCompleted}</p>
                <p className="text-xs text-sky-100 mt-1">Tasks Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Routine & Appointments Live Card */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">
              Today&apos;s Routine & Appointments
            </h2>
          </div>
          <Link
            to="/routine"
            className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            Manage Routine <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {loadingRoutine ? (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-center text-slate-500 text-sm">
              Loading today&apos;s routine...
            </CardContent>
          </Card>
        ) : todayRoutine.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-white">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    No routine tasks or appointments scheduled for today
                  </p>
                  <p className="text-sm text-slate-500">
                    Tell CogniCare AI (e.g. &ldquo;I have an appointment at 3pm&rdquo;) to add it automatically.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/assistant">
                  <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Ask Assistant
                  </Button>
                </Link>
                <Link to="/routine">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Routine
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2.5">
            {todayRoutine.slice(0, 4).map((reminder) => {
              const isAppt = reminder.type === "appointment";
              const isMed = reminder.type === "medicine";
              const Icon = isAppt ? Calendar : isMed ? Pill : Activity;
              const badgeClass = isAppt
                ? "bg-violet-100 text-violet-700 border-violet-200"
                : isMed
                ? "bg-sky-100 text-sky-700 border-sky-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200";

              return (
                <Card
                  key={reminder.id}
                  className={`transition-all border-slate-200 hover:border-slate-300 ${
                    reminder.is_done ? "bg-slate-50/70 opacity-75" : "bg-white"
                  }`}
                >
                  <CardContent className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => handleToggleDone(reminder)}
                        className="text-slate-300 hover:text-emerald-600 transition-colors shrink-0"
                        title={reminder.is_done ? "Mark pending" : "Mark done"}
                      >
                        {reminder.is_done ? (
                          <CheckCircle2 className="h-6 w-6 text-emerald-500 fill-emerald-100" />
                        ) : (
                          <Circle className="h-6 w-6 hover:text-emerald-500" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-700">
                            {formatDisplayTime(reminder.reminder_time)}
                          </span>
                          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 border ${badgeClass}`}>
                            <Icon className="h-2.5 w-2.5 mr-1" />
                            {reminder.type}
                          </Badge>
                        </div>
                        <p
                          className={`text-sm font-semibold truncate ${
                            reminder.is_done ? "text-slate-400 line-through" : "text-slate-900"
                          }`}
                        >
                          {reminder.title}
                        </p>
                      </div>
                    </div>

                    <Link to="/routine">
                      <Button variant="ghost" size="sm" className="text-xs text-sky-600 hover:text-sky-700 h-8 px-2">
                        Details →
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Connected CareTaker Section */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-slate-900">
              Your Connected CareTaker
            </h2>
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs py-0">
              Primary Care
            </Badge>
          </div>
          <Link
            to="/caregiver"
            className="text-sm font-medium text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            CareTaker Details <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {caretakerInfo ? (
          <Card className="overflow-hidden border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                {/* Caretaker Avatar & Bio */}
                <div className="flex items-start gap-4">
                  <div className="relative shrink-0">
                    <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white font-bold text-xl shadow-md">
                      {caretakerInfo.avatar || (caretakerInfo.name ? caretakerInfo.name.slice(0, 2).toUpperCase() : "CT")}
                    </div>
                    <span
                      className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow"
                      title="Active Caretaker"
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-slate-900">
                        {caretakerInfo.name}
                      </h3>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 flex items-center gap-1 text-[11px] py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {caretakerInfo.status || "Online"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-600">
                      Relationship: <span className="text-slate-900 font-semibold">{caretakerInfo.relationship || "Primary CareTaker"}</span>
                    </p>
                    <p className="text-xs text-slate-500 max-w-xl">
                      Monitors your daily routine, validates cognitive memories, and receives immediate alerts when you request assistance.
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5 sm:shrink-0">
                  {caretakerInfo.phone && caretakerInfo.phone.trim() && (
                    <a
                      href={`tel:${caretakerInfo.phone}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-slate-800"
                    >
                      <Phone className="h-4 w-4 text-emerald-400" />
                      Call CareTaker
                    </a>
                  )}
                  {caretakerInfo.email && caretakerInfo.email.trim() && (
                    <a
                      href={`mailto:${caretakerInfo.email}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4 text-sky-600" />
                      Email
                    </a>
                  )}
                  <Link
                    to="/assistant"
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm font-medium text-sky-700 transition-all hover:bg-sky-100"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Ask AI to Alert
                  </Link>
                </div>
              </div>

              {/* Quick Details Ribbon */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500">Phone:</span>
                  {caretakerInfo.phone && caretakerInfo.phone.trim() ? (
                    <a
                      href={`tel:${caretakerInfo.phone}`}
                      className="font-semibold text-slate-800 hover:text-sky-600 transition-colors"
                    >
                      {caretakerInfo.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400">Not provided</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-slate-500">Email:</span>
                  {caretakerInfo.email && caretakerInfo.email.trim() ? (
                    <a
                      href={`mailto:${caretakerInfo.email}`}
                      className="font-semibold text-slate-800 hover:text-sky-600 transition-colors truncate"
                    >
                      {caretakerInfo.email}
                    </a>
                  ) : (
                    <span className="text-slate-400">Not provided</span>
                  )}
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-700 font-medium">Verified Caregiver Access</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-slate-200 bg-white">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">
                    No CareTaker Connected Yet
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Share your Patient ID <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{patientId}</span> with your caregiver to connect.
                  </p>
                </div>
              </div>
              <Link to="/caregiver">
                <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                  CareTaker Details
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickActions.map((action) => (
            <Link key={action.path} to={action.path}>
              <motion.div
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Card className="group h-full cursor-pointer transition-shadow hover:shadow-[var(--shadow-elevated)]">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${action.color} shadow-sm`}
                    >
                      <action.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 group-hover:text-sky-700 transition-colors">
                        {action.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">{action.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-sky-500 transition-colors mt-1 shrink-0" />
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Memories Preview */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-sky-600" />
            <h2 className="text-lg font-semibold text-slate-900">Recent Memories</h2>
          </div>
          <Link
            to="/timeline"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View all
          </Link>
        </div>

        {loadingMemories ? (
          <Card className="border-slate-200">
            <CardContent className="p-6 text-center text-slate-500 text-sm">
              Loading recent memories...
            </CardContent>
          </Card>
        ) : memories.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-white">
            <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 shrink-0">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">
                    No memories stored yet
                  </p>
                  <p className="text-sm text-slate-500">
                    Tell CogniCare AI about your items, routine, or thoughts to start remembering.
                  </p>
                </div>
              </div>
              <Link to="/assistant">
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-1.5 shrink-0">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Talk to Assistant
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {memories.slice(0, 3).map((memory) => (
              <Link key={memory.id} to={`/memory/${memory.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer border-slate-200 bg-white">
                  <CardContent className="flex items-center gap-4 p-4">
                    <span className="text-2xl shrink-0">{getMemoryIcon(memory.memory_type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{memory.title}</p>
                      <p className="text-sm text-slate-500 truncate">
                        {memory.content ? `${memory.content} • ` : ""}
                        {formatMemoryDate(memory.created_at)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-semibold shrink-0">
                      {formatConfidence(memory.confidence)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
