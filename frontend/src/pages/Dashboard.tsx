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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { patientName, dashboardSummary, memories } from "@/data/mockData";
import { fetchPatientReminders, updateReminder, todayISO } from "@/lib/reminders";
import type { Reminder } from "@/types";

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
    title: "Connected CareTaker",
    description: "Online and available",
    icon: Users,
    path: "/caregiver",
    color: "from-rose-500 to-pink-600",
  },
];

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

export default function Dashboard() {
  const { user } = useAuth();
  const [todayRoutine, setTodayRoutine] = useState<Reminder[]>([]);
  const [loadingRoutine, setLoadingRoutine] = useState(true);

  const displayName = user && "name" in user ? user.name : patientName;
  const patientId = user?.id || "";

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

  useEffect(() => {
    if (patientId) {
      loadTodayRoutine();
    } else {
      setLoadingRoutine(false);
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

  const todayMemories = memories.filter((m) => m.dateGroup === "Today");
  const routineCompleted = todayRoutine.filter((r) => r.is_done).length;
  const routineTotal = todayRoutine.length;

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
            <p className="text-sm font-medium text-sky-600">Good morning</p>
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
                {dashboardSummary.careTakerStatus}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{dashboardSummary.memoriesStored}</p>
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
          <h2 className="text-lg font-semibold text-slate-900">Recent Memories</h2>
          <Link
            to="/timeline"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View all
          </Link>
        </div>
        <div className="space-y-3">
          {todayMemories.slice(0, 3).map((memory) => (
            <Link key={memory.id} to={`/memory/${memory.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer">
                <CardContent className="flex items-center gap-4 p-4">
                  <span className="text-2xl">{memory.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{memory.title}</p>
                    <p className="text-sm text-slate-500">{memory.date}</p>
                  </div>
                  <Badge variant="secondary">{memory.confidence}%</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
