import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Upload,
  CalendarPlus,
  Brain,
  Bell,
  Clock,
  Users,
  FileText,
  Activity,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const caregiverName = "Emily Johnson";

const summary = {
  lastActivity: "10:35 AM",
  patientStatus: "Patient Online",
  pendingRequests: 2,
  remindersToday: 4,
  criticalAlerts: 1,
};

const quickActions = [
  {
    title: "Upload Reports",
    description: "Medical reports & prescriptions",
    icon: Upload,
    path: "/caregiver/upload",
    color: "from-emerald-500 to-teal-600",
  },
  {
    title: "Add Reminder",
    description: "Medicine & appointments",
    icon: CalendarPlus,
    path: "/caregiver/reminders",
    color: "from-sky-500 to-blue-600",
  },
  {
    title: "Memory Requests",
    description: "Validate patient memories",
    icon: Brain,
    path: "/caregiver/memory-requests",
    color: "from-violet-500 to-purple-600",
  },
  {
    title: "Notifications",
    description: "Patient alerts",
    icon: Bell,
    path: "/caregiver/notifications",
    color: "from-amber-500 to-orange-600",
  },
  {
    title: "Patient Timeline",
    description: "View stored memories",
    icon: Clock,
    path: "/caregiver/timeline",
    color: "from-pink-500 to-rose-600",
  },
  {
    title: "Patient Profile",
    description: "John Doe",
    icon: Users,
    path: "/caregiver/patient",
    color: "from-cyan-500 to-indigo-600",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const item = {
  hidden: {
    opacity: 0,
    y: 16,
  },
  show: {
    opacity: 1,
    y: 0,
  },
};

export default function CaregiverDashboard() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 pb-20 lg:pb-8"
    >
      {/* Header */}

      <motion.div variants={item}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-sky-600">
              Good Morning
            </p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Welcome back, {caregiverName.split(" ")[0]}
            </h1>

            <p className="mt-2 text-slate-500">
              Monitor your patient's memories, reminders and daily activities.
            </p>
          </div>

          <Link
            to="/caregiver/patient"
            className="inline-flex items-center gap-2 self-start rounded-xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
          >
            <Activity className="h-4 w-4" />

            View Patient Summary

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

                  <h2 className="text-lg font-semibold">
                    Today's Summary
                  </h2>
                </div>

                <p className="mt-2 text-sm text-sky-100">
                  Last patient activity at {summary.lastActivity}
                </p>
              </div>

              <Badge className="border-0 bg-white/20 text-white hover:bg-white/20">
                {summary.patientStatus}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">
                  {summary.pendingRequests}
                </p>

                <p className="mt-1 text-xs text-sky-100">
                  Pending Requests
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">
                  {summary.remindersToday}
                </p>

                <p className="mt-1 text-xs text-sky-100">
                  Today's Reminders
                </p>
              </div>

              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">
                  {summary.criticalAlerts}
                </p>

                <p className="mt-1 text-xs text-sky-100">
                  Critical Alerts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
            {/* Quick Actions */}

            <motion.div variants={item}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Quick Actions
        </h2>

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

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                        {action.title}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {action.description}
                      </p>
                    </div>

                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-sky-500" />
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Recent Patient Activity */}

      <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Patient Activity
          </h2>

          <Link
            to="/caregiver/timeline"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View Timeline
          </Link>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 1,
              icon: "🧠",
              title: "Wallet location stored successfully",
              subtitle: "Today • Confidence 96%",
              badge: "Stored",
            },
            {
              id: 2,
              icon: "💊",
              title: "Medicine reminder completed",
              subtitle: "Today • 8:00 AM",
              badge: "Completed",
            },
            {
              id: 3,
              icon: "📄",
              title: "Prescription uploaded",
              subtitle: "Today • Processed",
              badge: "New",
            },
          ].map((activity) => (
            <Card
              key={activity.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className="text-2xl">{activity.icon}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">
                    {activity.title}
                  </p>

                  <p className="text-sm text-slate-500">
                    {activity.subtitle}
                  </p>
                </div>

                <Badge variant="secondary">{activity.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Pending Memory Requests */}

      <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Pending Memory Requests
          </h2>

          <Link
            to="/caregiver/memory-requests"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View All
          </Link>
        </div>

        <div className="space-y-4">
          {[
            {
              id: 1,
              question: "Where are my glasses?",
              status: "Waiting for Caregiver",
              priority: "High",
            },
            {
              id: 2,
              question: "When is my next appointment?",
              status: "Needs Validation",
              priority: "Medium",
            },
          ].map((request) => (
            <Card
              key={request.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">
                      Patient asked
                    </p>

                    <h3 className="mt-1 text-lg font-semibold text-slate-900">
                      "{request.question}"
                    </h3>

                    <div className="mt-3 flex gap-2">
                      <Badge variant="outline">
                        {request.status}
                      </Badge>

                      <Badge
                        className={
                          request.priority === "High"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                        }
                      >
                        {request.priority}
                      </Badge>
                    </div>
                  </div>

                  <Link
                    to="/caregiver/memory-requests"
                    className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
                  >
                    Review
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
            {/* Notifications */}

            <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Recent Notifications
          </h2>

          <Link
            to="/caregiver/notifications"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            View All
          </Link>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 1,
              icon: "🔔",
              title: "Patient missed morning medicine",
              subtitle: "10 minutes ago",
              badge: "High",
            },
            {
              id: 2,
              icon: "🧠",
              title: "Memory validation required",
              subtitle: "AI confidence below threshold",
              badge: "Review",
            },
            {
              id: 3,
              icon: "📅",
              title: "Doctor appointment tomorrow",
              subtitle: "Reminder scheduled",
              badge: "Upcoming",
            },
          ].map((notification) => (
            <Card
              key={notification.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <span className="text-2xl">{notification.icon}</span>

                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {notification.title}
                  </p>

                  <p className="text-sm text-slate-500">
                    {notification.subtitle}
                  </p>
                </div>

                <Badge variant="secondary">{notification.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Today's Reminders */}

      <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Today's Reminders
          </h2>

          <Link
            to="/caregiver/reminders"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            Manage
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              medicine: "Metformin",
              time: "8:00 AM",
              status: "Completed",
            },
            {
              medicine: "Aspirin",
              time: "9:00 PM",
              status: "Pending",
            },
            {
              medicine: "Doctor Appointment",
              time: "Tomorrow • 10:00 AM",
              status: "Upcoming",
            },
          ].map((item, index) => (
            <Card key={index}>
              <CardContent className="p-5">
                <h3 className="font-semibold text-slate-900">
                  {item.medicine}
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  {item.time}
                </p>

                <Badge className="mt-4">{item.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Uploaded Reports */}

      <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Uploaded Reports
          </h2>

          <Link
            to="/caregiver/upload"
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            Upload More
          </Link>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 1,
              title: "Blood Test Report",
              date: "Uploaded Today",
              status: "Processed",
            },
            {
              id: 2,
              title: "Prescription",
              date: "Yesterday",
              status: "Saved",
            },
            {
              id: 3,
              title: "MRI Scan",
              date: "Last Week",
              status: "Reviewed",
            },
          ].map((report) => (
            <Card
              key={report.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-4">
                <FileText className="h-10 w-10 rounded-lg bg-sky-100 p-2 text-sky-600" />

                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {report.title}
                  </p>

                  <p className="text-sm text-slate-500">
                    {report.date}
                  </p>
                </div>

                <Badge variant="secondary">{report.status}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Connected Patient */}

      <motion.div variants={item}>
        <Card className="border-0 shadow-[var(--shadow-soft)]">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-100 text-2xl">
                👴
              </div>

              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900">
                  John Doe
                </h2>

                <p className="text-sm text-slate-500">
                  Mild Cognitive Impairment
                </p>

                <div className="mt-3 flex gap-2">
                  <Badge className="bg-green-100 text-green-700">
                    Online
                  </Badge>

                  <Badge variant="outline">
                    Last Active • 10:35 AM
                  </Badge>
                </div>
              </div>

              <Link
                to="/caregiver/patient"
                className="rounded-lg bg-sky-600 px-4 py-2 text-white transition hover:bg-sky-700"
              >
                View Profile
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Statistics */}

      <motion.div variants={item}>
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              title: "Reports Uploaded",
              value: "12",
            },
            {
              title: "Memories Validated",
              value: "48",
            },
            {
              title: "Reminders Created",
              value: "19",
            },
            {
              title: "Critical Alerts",
              value: "3",
            },
          ].map((stat, index) => (
            <Card key={index}>
              <CardContent className="p-6 text-center">
                <p className="text-3xl font-bold text-sky-600">
                  {stat.value}
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  {stat.title}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}