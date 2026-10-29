import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Pill,
} from "lucide-react-native";
import { colors } from "../../../src/theme/colors";
import { Header } from "../../../src/components/ui/Header";
import { Card } from "../../../src/components/ui/Card";
import { Button } from "../../../src/components/ui/Button";
import { Input } from "../../../src/components/ui/Input";
import { Badge } from "../../../src/components/ui/Badge";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { RemindersApi, todayISO } from "../../../src/api/reminders";
import { useAuth } from "../../../src/context/AuthContext";
import type { Reminder } from "../../../src/types";

export default function PatientRemindersScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { patients } = useAuth();
  const currentPatient = patients.find((p) => p.id === id);

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // New Reminder form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"medicine" | "appointment" | "general">("medicine");
  const [dosage, setDosage] = useState("");
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReminders = useCallback(async () => {
    if (!id) return;
    try {
      const data = await RemindersApi.fetchPatientReminders(id as string, todayISO());
      setReminders(data);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReminders();
  };

  const handleToggle = async (r: Reminder) => {
    const newDone = !r.is_done;
    setReminders((prev) =>
      prev.map((item) => (item.id === r.id ? { ...item, is_done: newDone } : item))
    );

    try {
      await RemindersApi.updateReminder(r.id, { is_done: newDone });
    } catch {
      setReminders((prev) =>
        prev.map((item) => (item.id === r.id ? { ...item, is_done: !newDone } : item))
      );
      Alert.alert("Error", "Could not toggle reminder status.");
    }
  };

  const handleDelete = (reminderId: string) => {
    Alert.alert("Delete Reminder", "Are you sure you want to remove this reminder?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await RemindersApi.deleteReminder(reminderId);
            setReminders((prev) => prev.filter((r) => r.id !== reminderId));
          } catch {
            Alert.alert("Error", "Failed to delete reminder.");
          }
        },
      },
    ]);
  };

  const handleCreateReminder = async () => {
    if (!title.trim() || !time.trim()) {
      Alert.alert("Missing Fields", "Please enter title and time.");
      return;
    }

    setSubmitting(true);
    try {
      await RemindersApi.createSingleReminder({
        patient_id: id as string,
        title: title.trim(),
        type,
        dosage: dosage.trim() || null,
        reminder_time: time.trim(),
        reminder_date: todayISO(),
        notes: notes.trim() || null,
      });

      setTitle("");
      setDosage("");
      setTime("09:00");
      setNotes("");
      setModalVisible(false);
      loadReminders();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Could not add reminder.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={currentPatient ? currentPatient.name : "Patient Reminders"}
        subtitle={`Schedule for today (${reminders.length} items)`}
        showBack
        rightAction={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Plus size={22} color="#ffffff" />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {reminders.length === 0 ? (
          <EmptyState
            icon={<Calendar size={36} color={colors.primary} />}
            title="No Scheduled Items"
            message="No reminders currently scheduled for this patient today."
            actionTitle="Add New Reminder"
            onAction={() => setModalVisible(true)}
          />
        ) : (
          reminders.map((r) => (
            <Card key={r.id} style={styles.itemCard}>
              <View style={styles.itemRow}>
                <TouchableOpacity
                  style={styles.checkTouch}
                  onPress={() => handleToggle(r)}
                >
                  {r.is_done ? (
                    <CheckCircle2 size={26} color={colors.success} />
                  ) : (
                    <Circle size={26} color={colors.borderDark} />
                  )}
                </TouchableOpacity>

                <View style={styles.itemInfo}>
                  <Text
                    style={[
                      styles.itemTitle,
                      r.is_done && styles.itemTitleDone,
                    ]}
                  >
                    {r.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <Clock size={12} color={colors.textSecondary} />
                    <Text style={styles.timeText}>{r.reminder_time.slice(0, 5)}</Text>
                    {r.dosage ? (
                      <>
                        <Text style={styles.dot}>•</Text>
                        <Pill size={12} color={colors.primary} />
                        <Text style={styles.dosageText}>{r.dosage}</Text>
                      </>
                    ) : null}
                  </View>
                  {r.notes ? (
                    <Text style={styles.notesText}>{r.notes}</Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.deleteTouch}
                  onPress={() => handleDelete(r.id)}
                >
                  <Trash2 size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Reminder Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Daily Reminder</Text>
            <Text style={styles.modalSubtitle}>
              Create a medicine or general reminder for {currentPatient?.name || "this patient"}.
            </Text>

            <Input
              label="Reminder Title"
              placeholder="e.g. Donepezil 10mg"
              value={title}
              onChangeText={setTitle}
            />

            <Input
              label="Dosage (optional)"
              placeholder="e.g. 1 Tablet"
              value={dosage}
              onChangeText={setDosage}
            />

            <Input
              label="Time (HH:MM)"
              placeholder="09:00"
              value={time}
              onChangeText={setTime}
            />

            <Input
              label="Instructions / Notes (optional)"
              placeholder="e.g. Take with water after breakfast"
              value={notes}
              onChangeText={setNotes}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Save Reminder"
                onPress={handleCreateReminder}
                loading={submitting}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  itemCard: {
    padding: 16,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkTouch: {
    padding: 4,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  itemTitleDone: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  dot: {
    marginHorizontal: 6,
    color: colors.textMuted,
  },
  dosageText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  notesText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  deleteTouch: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
});
