import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  CalendarPlus,
  Pencil,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import AddPatientModal from "@/components/AddPatientModal";
import type { Reminder, ReminderDraft, ReminderType } from "@/types";
import {
  todayISO,
  fetchPatientReminders,
  addRemindersBulk,
  updateReminder,
  deleteReminder,
  isReminderEditable,
  reminderStatus,
} from "@/lib/reminders";

const emptyDraft = (): ReminderDraft => ({
  title: "",
  type: "medicine",
  dosage: "",
  reminder_time: "",
  notes: "",
});

const typeColors: Record<string, string> = {
  medicine: "bg-sky-100 text-sky-700",
  appointment: "bg-violet-100 text-violet-700",
  general: "bg-slate-100 text-slate-700",
};

const statusColors: Record<string, string> = {
  Done: "bg-green-100 text-green-700",
  Pending: "bg-amber-100 text-amber-700",
  Overdue: "bg-red-100 text-red-700",
};

export default function MyPatients() {
  const { patients, fetchPatients } = useAuth();
  const [selectedId, setSelectedId] = useState<string>("");
  const [tab, setTab] = useState<"add" | "update">("add");
  const [showAddPatient, setShowAddPatient] = useState(false);

  // Add tab state
  const [addDate, setAddDate] = useState(todayISO());
  const [drafts, setDrafts] = useState<ReminderDraft[]>([emptyDraft()]);
  const [saving, setSaving] = useState(false);

  // Update tab state
  const [updateDate, setUpdateDate] = useState(todayISO());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reminder>>({});

  const selected = useMemo(
    () => patients.find((p) => p.id === selectedId),
    [patients, selectedId]
  );

  useEffect(() => {
    fetchPatients();
  }, []);

  useEffect(() => {
    if (!selectedId && patients.length > 0) setSelectedId(patients[0].id);
  }, [patients, selectedId]);

  // Reset add form when patient changes
  useEffect(() => {
    setAddDate(todayISO());
    setDrafts([emptyDraft()]);
  }, [selectedId]);

  const loadReminders = async (patientId: string, date: string) => {
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
    if (tab === "update" && selectedId) loadReminders(selectedId, updateDate);
  }, [tab, selectedId, updateDate]);

  const summary = useMemo(() => {
    const total = reminders.length;
    const done = reminders.filter((r) => r.is_done).length;
    const overdue = reminders.filter((r) => reminderStatus(r) === "Overdue").length;
    return { total, done, pending: total - done, overdue };
  }, [reminders]);

  const updateDraft = (i: number, patch: Partial<ReminderDraft>) => {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };

  const handleAddSubmit = async () => {
    if (!selectedId) return;
    for (const d of drafts) {
      if (!d.title.trim()) return alert("Each reminder needs a title");
      if (!d.reminder_time) return alert("Each reminder needs a time");
    }
    setSaving(true);
    try {
      await addRemindersBulk(selectedId, addDate, drafts);
      alert(`${drafts.length} reminder(s) added for ${addDate}`);
      setDrafts([emptyDraft()]);
      if (tab === "update") loadReminders(selectedId, updateDate);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to add reminders");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (r: Reminder) => {
    try {
      await updateReminder(r.id, { is_done: !r.is_done });
      await loadReminders(r.patient_id, updateDate);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to update status");
    }
  };

  const startEdit = (r: Reminder) => {
    setEditingId(r.id);
    setEditForm({
      title: r.title,
      type: r.type,
      dosage: r.dosage || "",
      reminder_time: r.reminder_time.slice(0, 5),
      notes: r.notes || "",
    });
  };

  const saveEdit = async (r: Reminder) => {
    try {
      await updateReminder(r.id, {
        title: editForm.title as string,
        type: editForm.type as ReminderType,
        dosage: (editForm.dosage as string) || null,
        reminder_time: editForm.reminder_time as string,
        notes: (editForm.notes as string) || null,
      });
      setEditingId(null);
      await loadReminders(r.patient_id, updateDate);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to update reminder");
    }
  };

  const handleDelete = async (r: Reminder) => {
    if (!confirm("Delete this reminder?")) return;
    try {
      await deleteReminder(r.id);
      await loadReminders(r.patient_id, updateDate);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Failed to delete");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">My Patients</h1>
          <p className="mt-1 text-slate-500">
            View details, add reminders and track fulfillment.
          </p>
        </div>
        <Button onClick={() => setShowAddPatient(true)}>
          <UserPlus className="h-4 w-4" /> Add Patient
        </Button>
      </div>

      {patients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sky-50">
              <Users className="h-7 w-7 text-sky-400" />
            </div>
            <p className="mt-4 font-medium text-slate-900">No patients yet</p>
            <p className="mt-1 text-sm text-slate-500">Add a patient to manage reminders</p>
            <Button onClick={() => setShowAddPatient(true)} size="sm" className="mt-4">
              <UserPlus className="mr-2 h-4 w-4" /> Add Patient
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Patient list */}
          <Card>
            <CardContent className="p-4">
              <p className="px-1 pb-3 text-sm font-semibold text-slate-700">
                Patients ({patients.length})
              </p>
              <div className="space-y-2">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedId === p.id
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-100 bg-white hover:border-sky-200 hover:bg-slate-50"
                    }`}
                  >
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{p.id}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{p.location}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Detail */}
          <div className="space-y-6">
            {selected && (
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-lg">
                        👤
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                        <p className="font-mono text-xs text-slate-500">{selected.id}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          📞 {selected.phone} &middot; 📍 {selected.location}
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-700">Active</Badge>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                onClick={() => setTab("add")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                  tab === "add" ? "bg-white text-sky-600 shadow" : "text-slate-500"
                }`}
              >
                <CalendarPlus className="h-4 w-4" /> Add Reminders
              </button>
              <button
                onClick={() => setTab("update")}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition ${
                  tab === "update" ? "bg-white text-sky-600 shadow" : "text-slate-500"
                }`}
              >
                <Pencil className="h-4 w-4" /> Update Reminders
              </button>
            </div>

            {tab === "add" ? (
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Date (default today)</label>
                    <Input
                      type="date"
                      className="mt-2 max-w-xs"
                      value={addDate}
                      onChange={(e) => setAddDate(e.target.value)}
                    />
                  </div>

                  {drafts.map((d, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          Reminder {i + 1}
                        </p>
                        {drafts.length > 1 && (
                          <button
                            onClick={() => setDrafts((prev) => prev.filter((_, idx) => idx !== i))}
                            className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label className="text-xs font-medium text-slate-600">Title *</label>
                          <Input
                            className="mt-1"
                            placeholder="e.g. Take Metformin"
                            value={d.title}
                            onChange={(e) => updateDraft(i, { title: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Type</label>
                          <select
                            className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            value={d.type}
                            onChange={(e) => updateDraft(i, { type: e.target.value as ReminderType })}
                          >
                            <option value="medicine">Medicine</option>
                            <option value="appointment">Appointment</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-slate-600">Time *</label>
                          <Input
                            type="time"
                            className="mt-1"
                            value={d.reminder_time}
                            onChange={(e) => updateDraft(i, { reminder_time: e.target.value })}
                          />
                        </div>
                        {d.type === "medicine" && (
                          <div>
                            <label className="text-xs font-medium text-slate-600">Dosage</label>
                            <Input
                              className="mt-1"
                              placeholder="e.g. 1 tablet after breakfast"
                              value={d.dosage}
                              onChange={(e) => updateDraft(i, { dosage: e.target.value })}
                            />
                          </div>
                        )}
                        <div className={d.type === "medicine" ? "" : "sm:col-span-2"}>
                          <label className="text-xs font-medium text-slate-600">Notes</label>
                          <Input
                            className="mt-1"
                            placeholder="Optional notes"
                            value={d.notes}
                            onChange={(e) => updateDraft(i, { notes: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      variant="outline"
                      onClick={() => setDrafts((prev) => [...prev, emptyDraft()])}
                    >
                      <Plus className="h-4 w-4" /> Add another
                    </Button>
                    <Button onClick={handleAddSubmit} disabled={saving} className="sm:ml-auto">
                      <CalendarPlus className="h-4 w-4" />
                      {saving ? "Saving..." : `Save ${drafts.length} reminder(s)`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <label className="text-sm font-medium text-slate-700">
                        Select date (default today)
                      </label>
                      <Input
                        type="date"
                        className="mt-2 max-w-xs"
                        value={updateDate}
                        onChange={(e) => setUpdateDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge className="bg-slate-100 text-slate-700">Total: {summary.total}</Badge>
                      <Badge className="bg-green-100 text-green-700">Done: {summary.done}</Badge>
                      <Badge className="bg-amber-100 text-amber-700">
                        Pending: {summary.pending}
                      </Badge>
                    </div>
                  </div>

                  {loading ? (
                    <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
                  ) : reminders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                      <p className="font-medium text-slate-900">There are no reminders</p>
                      <p className="mt-1 text-sm text-slate-500">
                        No reminders for {updateDate}. Add some from the Add tab.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={() => setTab("add")}
                      >
                        Go to Add Reminders
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reminders.map((r) => {
                        const status = reminderStatus(r);
                        const editable = isReminderEditable(r);
                        const isEditing = editingId === r.id;
                        return (
                          <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                            {isEditing ? (
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                  <label className="text-xs font-medium text-slate-600">Title</label>
                                  <Input
                                    className="mt-1"
                                    value={(editForm.title as string) || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Type</label>
                                  <select
                                    className="mt-1 flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                                    value={(editForm.type as string) || "general"}
                                    onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as ReminderType }))}
                                  >
                                    <option value="medicine">Medicine</option>
                                    <option value="appointment">Appointment</option>
                                    <option value="general">General</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Time</label>
                                  <Input
                                    type="time"
                                    className="mt-1"
                                    value={(editForm.reminder_time as string) || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, reminder_time: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Dosage</label>
                                  <Input
                                    className="mt-1"
                                    value={(editForm.dosage as string) || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, dosage: e.target.value }))}
                                  />
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-slate-600">Notes</label>
                                  <Input
                                    className="mt-1"
                                    value={(editForm.notes as string) || ""}
                                    onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                                  />
                                </div>
                                <div className="flex gap-2 sm:col-span-2">
                                  <Button size="sm" onClick={() => saveEdit(r)}>Save</Button>
                                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <button
                                  onClick={() => handleToggleDone(r)}
                                  className="mt-0.5"
                                  title={r.is_done ? "Mark as not done" : "Mark as done"}
                                >
                                  {r.is_done ? (
                                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                                  ) : (
                                    <Circle className="h-5 w-5 text-slate-300 hover:text-green-500" />
                                  )}
                                </button>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p
                                      className={`font-medium ${
                                        r.is_done ? "text-slate-400 line-through" : "text-slate-900"
                                      }`}
                                    >
                                      {r.reminder_time.slice(0, 5)} — {r.title}
                                    </p>
                                    <Badge className={typeColors[r.type] || typeColors.general}>
                                      {r.type}
                                    </Badge>
                                    <Badge className={statusColors[status]}>{status}</Badge>
                                  </div>
                                  {(r.dosage || r.notes) && (
                                    <p className="mt-1 text-sm text-slate-500">
                                      {[r.dosage, r.notes].filter(Boolean).join(" · ")}
                                    </p>
                                  )}
                                  {r.is_done && (
                                    <p className="mt-1 text-xs text-green-600">
                                      Fulfilled{r.done_by ? ` by ${r.done_by}` : ""}
                                    </p>
                                  )}
                                  {!editable && !r.is_done && (
                                    <p className="mt-1 text-xs text-slate-400">
                                      Past time — only completion status can change.
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                  {editable && (
                                    <>
                                      <button
                                        onClick={() => startEdit(r)}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                                        title="Edit"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(r)}
                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      <AddPatientModal open={showAddPatient} onClose={() => setShowAddPatient(false)} />
    </motion.div>
  );
}
