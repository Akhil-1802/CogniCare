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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { patientName, dashboardSummary, memories } from "@/data/mockData";

const quickActions = [
  {
    title: "AI Assistant",
    description: "Chat and store memories",
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
    description: "Caregiver alert flow",
    icon: Bell,
    path: "/notifications",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Connected Caregiver",
    description: "Emily Johnson — Online",
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
  const todayMemories = memories.filter((m) => m.dateGroup === "Today");

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
              Welcome back, {patientName.split(" ")[0]}
            </h1>
            <p className="mt-2 text-slate-500">
              Your cognitive memory assistant is ready to help you today.
            </p>
          </div>
          <Link
            to="/engine"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
          >
            <Brain className="h-4 w-4" />
            View Memory Engine
            <ArrowRight className="h-4 w-4" />
          </Link>
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
                  Last interaction at {dashboardSummary.lastInteraction}
                </p>
              </div>
              <Badge className="bg-white/20 text-white border-0 hover:bg-white/20">
                {dashboardSummary.caregiverStatus}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{dashboardSummary.memoriesStored}</p>
                <p className="text-xs text-sky-100 mt-1">Memories Stored</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{dashboardSummary.remindersToday}</p>
                <p className="text-xs text-sky-100 mt-1">Reminders Today</p>
              </div>
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{todayMemories.length}</p>
                <p className="text-xs text-sky-100 mt-1">New Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
