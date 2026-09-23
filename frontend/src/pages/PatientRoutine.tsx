import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarCheck,
  Clock,
  Pill,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Sparkles,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Activity,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import type { Reminder, ReminderType } from "@/types";
import {
  todayISO,
  fetchPatientReminders,
  updateReminder,
  deleteReminder,
  createSingleReminder,
} from "@/lib/reminders";

const typeConfig: Record<
  ReminderType,
  { label: string; badgeClass: string; icon: typeof Calendar }
> = {
  appointment: {
    label: "Appointment",
    badgeClass: "bg-violet-100 text-violet-700 border-violet-200",
    icon: Calendar,
  },
  medicine: {
    label: "Medicine",
    badgeClass: "bg-sky-100 text-sky-700 border-sky-200",
    icon: Pill,
  },
  general: {
    label: "Daily Activity",
    badgeClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: Activity,
  },
};

export default function PatientRoutine() {
  const { user, role } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | ReminderType>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Add routine modal form state
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<ReminderType>("appointment");
  const [newTime, setNewTime] = useState("10:00");
  const [newDosage, setNewDosage] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const patientId = user?.id || "";

  const loadData = async (date: string) => {
    if (!patientId) return;
    setLoading(true);
    try {
      const data = await fetchPatientReminders(patientId, date);
      setReminders(data);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadData(selectedDate);
    }
  }, [patientId, selectedDate]);

  const handleToggleDone = async (reminder: Reminder) => {
    setActionLoadingId(reminder.id);
    const newStatus = !reminder.is_done;
    try {
      await updateReminder(reminder.id, { is_done: newStatus });
      setReminders((prev) =>
        prev.map((r) =>
          r.id === reminder.id ? { ...r, is_done: newStatus } : r
        )
      );
    } catch (e) {
      console.error("Failed to update status", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDelete = async (reminderId: string) => {
    setActionLoadingId(reminderId);
    try {
      await deleteReminder(reminderId);
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (e) {
      console.error("Failed to delete", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormError("Title is required");
      return;
    }
    if (!newTime) {
      setFormError("Time is required");
      return;
    }
    setIsSubmitting(true);
    setFormError("");
    try {
      await createSingleReminder({
        patient_id: patientId,
        title: newTitle.trim(),
        type: newType,
        reminder_date: selectedDate,
        reminder_time: newTime,
        dosage: newDosage.trim() || null,
        notes: newNotes.trim() || null,
      });
      setShowAddModal(false);
      setNewTitle("");
      setNewDosage("");
      setNewNotes("");
      setNewTime("10:00");
      await loadData(selectedDate);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;
      setFormError(detail || "Failed to add item to routine.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredReminders = useMemo(() => {
    if (activeTab === "all") return reminders;
    return reminders.filter((r) => (r.type || "general") === activeTab);
  }, [reminders, activeTab]);

  const totalCount = reminders.length;
  const doneCount = reminders.filter((r) => r.is_done).length;
  const percentDone = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const isToday = selectedDate === todayISO();

  const nextUpcoming = useMemo(() => {
    return reminders.find((r) => !r.is_done);
  }, [reminders]);

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
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-sky-600" />
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Daily Routine & Appointments
            </h1>
          </div>
          <p className="mt-1 text-slate-500">
            Keep track of your scheduled appointments, medicines, and daily activities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => setShowAddModal(true)}
            className="gap-2 bg-sky-600 hover:bg-sky-700 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add to Routine
          </Button>

          <Link to="/assistant">
            <Button variant="outline" className="gap-2 border-sky-200 text-sky-700 hover:bg-sky-50">
              <MessageSquare className="h-4 w-4" />
              Ask AI Assistant
            </Button>
          </Link>
        </div>
      </div>

      {/* Date Bar & Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Date Selector Card */}
        <Card className="sm:col-span-2 shadow-sm border-slate-200">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant={isToday ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedDate(todayISO())}
                className={isToday ? "bg-sky-600 hover:bg-sky-700" : ""}
              >
                Today
              </Button>
              <Button
                variant={
                  selectedDate ===
                  new Date(Date.now() + 86400000).toISOString().slice(0, 10)
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  const tmrw = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
                  setSelectedDate(tmrw);
                }}
              >
                Tomorrow
              </Button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Clock className="h-4 w-4 text-slate-400 shrink-0" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto text-sm font-medium"
              />
            </div>
          </CardContent>
        </Card>

        {/* Progress Card */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Today's Progress</span>
              <span>{percentDone}%</span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {doneCount} / {totalCount}{" "}
              <span className="text-xs font-normal text-slate-500">done</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${percentDone}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Next Up Card */}
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Next Upcoming</p>
            {nextUpcoming ? (
              <div className="mt-1">
                <p className="font-semibold text-slate-900 truncate">
                  {nextUpcoming.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {formatDisplayTime(nextUpcoming.reminder_time)}
                  </Badge>
                  <span className="text-xs capitalize text-slate-500">
                    {nextUpcoming.type}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400 font-medium">
                {totalCount === 0 ? "No tasks scheduled" : "All tasks completed! 🎉"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "all", label: "All Items", count: reminders.length },
          {
            key: "appointment",
            label: "Appointments 📅",
            count: reminders.filter((r) => r.type === "appointment").length,
          },
          {
            key: "medicine",
            label: "Medicines 💊",
            count: reminders.filter((r) => r.type === "medicine").length,
          },
          {
            key: "general",
            label: "Daily Activities 🏃‍♂️",
            count: reminders.filter((r) => (r.type || "general") === "general").length,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Routine Timeline List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="border-slate-200">
            <CardContent className="p-8 text-center text-slate-500">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
              <p className="mt-2 text-sm">Loading your daily routine...</p>
            </CardContent>
          </Card>
        ) : filteredReminders.length === 0 ? (
          <Card className="border-dashed border-slate-200 bg-white">
            <CardContent className="flex flex-col items-center justify-center p-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 shadow-inner">
                <CalendarCheck className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                No routine items for this day
              </h3>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                {activeTab === "all"
                  ? "You don't have any appointments or activities scheduled. You can add one manually or simply ask CogniCare AI in chat!"
                  : `You don't have any ${activeTab} items for this day.`}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => setShowAddModal(true)}
                  size="sm"
                  className="gap-2 bg-sky-600 hover:bg-sky-700"
                >
                  <Plus className="h-4 w-4" />
                  Add New Item
                </Button>
                <Link to="/assistant">
                  <Button variant="outline" size="sm" className="gap-2 text-sky-700 border-sky-200">
                    <MessageSquare className="h-4 w-4" />
                    Tell CogniCare AI
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {filteredReminders.map((reminder) => {
              const cfg = typeConfig[reminder.type] || typeConfig.general;
              const Icon = cfg.icon;
              const isUpdating = actionLoadingId === reminder.id;

              return (
                <motion.div
                  key={reminder.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className={`transition-all border-slate-200 hover:border-slate-300 hover:shadow-sm ${
                      reminder.is_done ? "bg-slate-50/60 opacity-80" : "bg-white"
                    }`}
                  >
                    <CardContent className="p-4 sm:p-5 flex items-start sm:items-center justify-between gap-4">
                      {/* Left: Checkbox + Content */}
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        {/* Toggle Check Button */}
                        <button
                          onClick={() => handleToggleDone(reminder)}
                          disabled={isUpdating}
                          className="mt-0.5 sm:mt-0 shrink-0 text-slate-300 hover:text-emerald-600 transition-colors focus:outline-none"
                          title={reminder.is_done ? "Mark as pending" : "Mark as completed"}
                        >
                          {reminder.is_done ? (
                            <CheckCircle2 className="h-7 w-7 text-emerald-500 fill-emerald-100" />
                          ) : (
                            <Circle className="h-7 w-7 hover:text-emerald-500" />
                          )}
                        </button>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
                              <Clock className="h-4 w-4 text-sky-600" />
                              {formatDisplayTime(reminder.reminder_time)}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs font-medium border ${cfg.badgeClass}`}
                            >
                              <Icon className="h-3 w-3 mr-1" />
                              {cfg.label}
                            </Badge>
                            {reminder.is_done && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">
                                <Check className="h-3 w-3 mr-1" /> Done
                              </Badge>
                            )}
                          </div>

                          <h3
                            className={`text-base font-semibold transition-colors truncate ${
                              reminder.is_done
                                ? "text-slate-400 line-through"
                                : "text-slate-900"
                            }`}
                          >
                            {reminder.title}
                          </h3>

                          {(reminder.dosage || reminder.notes) && (
                            <p className="mt-1 text-sm text-slate-500 truncate">
                              {reminder.dosage && (
                                <span className="font-medium text-slate-700 mr-2">
                                  Dosage: {reminder.dosage}
                                </span>
                              )}
                              {reminder.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!reminder.is_done && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(reminder.id)}
                            disabled={isUpdating}
                            className="text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Delete item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add to Routine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">Add to Routine</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[
                    { type: "appointment", label: "Appointment 📅" },
                    { type: "medicine", label: "Medicine 💊" },
                    { type: "general", label: "Activity 🏃‍♂️" },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setNewType(item.type as ReminderType)}
                      className={`py-2 px-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                        newType === item.type
                          ? "bg-sky-50 border-sky-600 text-sky-700 shadow-sm"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Title
                </label>
                <Input
                  placeholder={
                    newType === "appointment"
                      ? "e.g. Doctor Appointment with Dr. Smith"
                      : newType === "medicine"
                      ? "e.g. Take Metformin after lunch"
                      : "e.g. Morning 30-min walk in park"
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Date
                  </label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="mt-1"
                    required
                  />
                </div>
              </div>

              {newType === "medicine" && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Dosage (optional)
                  </label>
                  <Input
                    placeholder="e.g. 500mg, 1 tablet"
                    value={newDosage}
                    onChange={(e) => setNewDosage(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Notes / Instructions (optional)
                </label>
                <Textarea
                  placeholder="e.g. Remember to bring medical reports, take with full glass of water..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="mt-1 text-sm resize-none"
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-sky-600 hover:bg-sky-700"
                >
                  {isSubmitting ? "Saving..." : "Save to Routine"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
