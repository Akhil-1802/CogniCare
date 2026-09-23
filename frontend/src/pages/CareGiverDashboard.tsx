import { useEffect, useState } from "react";
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
  UserPlus,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import AddPatientModal from "@/components/AddPatientModal";
import { fetchMyReminders, todayISO } from "@/lib/reminders";

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

export default function CareTakerDashboard() {
  const { user, patients } = useAuth();
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [remindersToday, setRemindersToday] = useState(0);
  const [remindersDoneToday, setRemindersDoneToday] = useState(0);

  const caretakerName = user && "name" in user ? user.name : "CareTaker";

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchMyReminders(todayISO());
        setRemindersToday(data.length);
        setRemindersDoneToday(data.filter((r) => r.is_done).length);
      } catch {
        setRemindersToday(0);
        setRemindersDoneToday(0);
      }
    };
    load();
  }, []);

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
            <p className="text-sm font-medium text-sky-600">Good Morning</p>

            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
              Welcome back, {caretakerName.split(" ")[0]}
            </h1>

            <p className="mt-2 text-slate-500">
              Monitor your patient's memories, reminders and daily activities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={() => setShowAddPatient(true)}
              className="inline-flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Add Patient
            </Button>
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

                  <h2 className="text-lg font-semibold">Today's Summary</h2>
                </div>

                <p className="mt-2 text-sm text-sky-100">
                  {patients.length} patient{patients.length !== 1 ? "s" : ""} connected
                </p>
              </div>

              <Badge className="border-0 bg-white/20 text-white hover:bg-white/20">
                {patients.length > 0 ? "Patients Active" : "No Patients"}
              </Badge>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{patients.length}</p>

                <p className="mt-1 text-xs text-sky-100">Total Patients</p>
              </div>

              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{remindersToday}</p>

                <p className="mt-1 text-xs text-sky-100">Reminders Today</p>
              </div>

              <div className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-2xl font-bold">{remindersDoneToday}</p>

                <p className="mt-1 text-xs text-sky-100">Fulfilled Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Patients List */}

      <motion.div variants={item}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Your Patients
          </h2>

          <button
            onClick={() => setShowAddPatient(true)}
            className="text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            + Add New
          </button>
        </div>

        {patients.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50">
                <Users className="h-7 w-7 text-sky-400" />
              </div>
              <p className="mt-4 font-medium text-slate-900">No patients yet</p>
              <p className="mt-1 text-sm text-slate-500">
                Add a patient to get started
              </p>
              <Button
                onClick={() => setShowAddPatient(true)}
                className="mt-4"
                size="sm"
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Add Patient
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => (
              <Link key={patient.id} to="/caregiver/patients">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg">
                      👤
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {patient.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {patient.id} &middot; {patient.location}
                      </p>
                    </div>

                    <Badge className="bg-green-100 text-green-700">
                      Active
                    </Badge>
                    <span className="text-sm font-medium text-sky-600">Manage →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      {/* Quick Actions */}

      <motion.div variants={item}>
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Quick Actions
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Upload Records & OCR",
              description: "Prescriptions & medicine images",
              icon: Upload,
              path: "/caregiver/upload-records",
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
          ].map((action) => (
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

      <AddPatientModal open={showAddPatient} onClose={() => setShowAddPatient(false)} />
    </motion.div>
  );
}
