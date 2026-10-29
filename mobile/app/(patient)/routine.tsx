import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  CheckCircle2,
  Circle,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Pill,
  Clock,
  Calendar,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Header } from "../../src/components/ui/Header";
import { RemindersApi, todayISO } from "../../src/api/reminders";
import type { Reminder } from "../../src/types";

type TimeSlot = "Morning" | "Afternoon" | "Evening" | "Night";

function getTimeSlot(timeStr: string): TimeSlot {
  const hour = parseInt(timeStr.slice(0, 2), 10);
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export default function PatientRoutine() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReminders = useCallback(async () => {
    try {
      const data = await RemindersApi.fetchMyReminders(todayISO());
      setReminders(data);
    } catch {
      setReminders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReminders();
  };

  const handleToggle = async (item: Reminder) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const newDone = !item.is_done;
    setReminders((prev) =>
      prev.map((r) => (r.id === item.id ? { ...r, is_done: newDone } : r))
    );

    try {
      await RemindersApi.updateReminder(item.id, { is_done: newDone });
    } catch {
      setReminders((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, is_done: !newDone } : r))
      );
      Alert.alert("Update failed", "Could not synchronize routine status.");
    }
  };

  const slots: Array<{
    slot: TimeSlot;
    title: string;
    icon: React.ReactNode;
    color: string;
    bgColor: string;
  }> = [
    {
      slot: "Morning",
      title: "Morning Routine",
      icon: <Sunrise size={22} color={colors.morning} />,
      color: colors.morning,
      bgColor: "#fef3c7",
    },
    {
      slot: "Afternoon",
      title: "Afternoon Routine",
      icon: <Sun size={22} color={colors.afternoon} />,
      color: colors.afternoon,
      bgColor: "#e0f2fe",
    },
    {
      slot: "Evening",
      title: "Evening Routine",
      icon: <Sunset size={22} color={colors.evening} />,
      color: colors.evening,
      bgColor: "#f3e8ff",
    },
    {
      slot: "Night",
      title: "Night Routine",
      icon: <Moon size={22} color={colors.night} />,
      color: colors.night,
      bgColor: "#dbeafe",
    },
  ];

  const total = reminders.length;
  const completed = reminders.filter((r) => r.is_done).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Daily Routine"
        subtitle={`${completed} of ${total} finished today`}
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
        {slots.map(({ slot, title, icon, color, bgColor }) => {
          const slotItems = reminders.filter((r) => getTimeSlot(r.reminder_time) === slot);

          return (
            <View key={slot} style={styles.slotSection}>
              {/* Slot Header */}
              <View style={styles.slotHeaderRow}>
                <View style={[styles.slotIconCircle, { backgroundColor: bgColor }]}>
                  {icon}
                </View>
                <View style={styles.slotHeaderTextWrap}>
                  <Text style={styles.slotTitle}>{title}</Text>
                  <Text style={styles.slotCount}>
                    {slotItems.filter((i) => i.is_done).length}/{slotItems.length} completed
                  </Text>
                </View>
              </View>

              {slotItems.length === 0 ? (
                <View style={styles.emptySlotBox}>
                  <Text style={styles.emptySlotText}>No items scheduled for {slot.toLowerCase()}</Text>
                </View>
              ) : (
                slotItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => handleToggle(item)}
                  >
                    <Card
                      style={[
                        styles.itemCard,
                        item.is_done && styles.itemCardDone,
                      ]}
                    >
                      <View style={styles.itemRow}>
                        <TouchableOpacity
                          style={styles.checkBtn}
                          onPress={() => handleToggle(item)}
                        >
                          {item.is_done ? (
                            <CheckCircle2 size={28} color={colors.success} />
                          ) : (
                            <Circle size={28} color={colors.borderDark} />
                          )}
                        </TouchableOpacity>

                        <View style={styles.itemContent}>
                          <Text
                            style={[
                              styles.itemTitle,
                              item.is_done && styles.itemTitleDone,
                            ]}
                          >
                            {item.title}
                          </Text>

                          <View style={styles.metaRow}>
                            <Clock size={13} color={colors.textSecondary} />
                            <Text style={styles.metaText}>
                              {item.reminder_time.slice(0, 5)}
                            </Text>

                            {item.dosage ? (
                              <>
                                <Text style={styles.metaDot}>•</Text>
                                <Pill size={13} color={colors.primary} />
                                <Text style={styles.dosageText}>
                                  {item.dosage}
                                </Text>
                              </>
                            ) : null}
                          </View>

                          {item.notes ? (
                            <Text style={styles.notesText}>{item.notes}</Text>
                          ) : null}
                        </View>

                        <Badge
                          label={item.is_done ? "Done" : "Pending"}
                          variant={item.is_done ? "success" : "neutral"}
                        />
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>
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
  slotSection: {
    marginBottom: 24,
  },
  slotHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  slotIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  slotHeaderTextWrap: {
    flex: 1,
  },
  slotTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  slotCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  emptySlotBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderDark,
    alignItems: "center",
  },
  emptySlotText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  itemCard: {
    padding: 16,
    marginBottom: 8,
  },
  itemCardDone: {
    backgroundColor: "#f8fafc",
    opacity: 0.65,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkBtn: {
    padding: 4,
    marginRight: 12,
  },
  itemContent: {
    flex: 1,
    marginRight: 10,
  },
  itemTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  itemTitleDone: {
    textDecorationLine: "line-through",
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  metaDot: {
    marginHorizontal: 6,
    color: colors.textMuted,
  },
  dosageText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "600",
    marginLeft: 4,
  },
  notesText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    fontStyle: "italic",
  },
});
