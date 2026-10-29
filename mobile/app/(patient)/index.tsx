import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  Phone,
  ArrowRight,
  Pill,
  Calendar,
  Clock,
  Brain,
  MessageSquare,
  LogOut,
  Camera,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { RemindersApi, todayISO } from "../../src/api/reminders";
import { MemoriesApi } from "../../src/api/memories";
import type { Reminder, Memory, Patient } from "../../src/types";

export default function PatientDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const patient = user as Patient | null;

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboardData = useCallback(async () => {
    try {
      const [rems, mems] = await Promise.all([
        RemindersApi.fetchMyReminders(todayISO()).catch(() => []),
        MemoriesApi.listMemories("ACTIVE").catch(() => []),
      ]);
      setReminders(rems);
      setMemories(mems.slice(0, 3));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const handleToggleReminder = async (item: Reminder) => {
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
      // Revert on failure
      setReminders((prev) =>
        prev.map((r) => (r.id === item.id ? { ...r, is_done: !newDone } : r))
      );
      Alert.alert("Error", "Could not update routine status.");
    }
  };

  const completedCount = reminders.filter((r) => r.is_done).length;
  const progressPercent = reminders.length
    ? Math.round((completedCount / reminders.length) * 100)
    : 100;

  const formattedDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const handleCallCaregiver = () => {
    const phone = patient?.caretaker?.phone;
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      router.push("/(patient)/caregiver");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Top Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>Hello, {patient?.name || "Friend"}</Text>
            <Text style={styles.dateText}>{formattedDate}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => {
              Alert.alert("Sign Out", "Are you sure you want to exit?", [
                { text: "Cancel", style: "cancel" },
                { text: "Sign Out", style: "destructive", onPress: logout },
              ]);
            }}
          >
            <LogOut size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* AI Voice Assistant Big Quick Launch Banner */}
        <TouchableOpacity
          style={styles.assistantBanner}
          activeOpacity={0.88}
          onPress={() => router.push("/(patient)/assistant")}
        >
          <View style={styles.assistantBannerLeft}>
            <View style={styles.assistantIconCircle}>
              <Sparkles size={28} color="#ffffff" />
            </View>
            <View style={styles.assistantTextWrap}>
              <Text style={styles.assistantTitle}>Talk to CogniCare</Text>
              <Text style={styles.assistantSubtitle}>
                Ask "Where are my keys?" or "What's my medicine schedule?"
              </Text>
            </View>
          </View>
          <ArrowRight size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* Today's Schedule Progress Card */}
        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View>
              <Text style={styles.cardHeading}>Today's Routine</Text>
              <Text style={styles.cardSubheading}>
                {completedCount} of {reminders.length} items completed
              </Text>
            </View>
            <Text style={styles.progressPercentText}>{progressPercent}%</Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>
        </Card>

        {/* Up Next Reminders */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <TouchableOpacity onPress={() => router.push("/(patient)/routine")}>
            <Text style={styles.seeAllText}>View Routine</Text>
          </TouchableOpacity>
        </View>

        {reminders.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Calendar size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>All clear for today!</Text>
            <Text style={styles.emptyMessage}>
              No scheduled medications or tasks remaining today.
            </Text>
          </Card>
        ) : (
          reminders.slice(0, 4).map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.7}
              onPress={() => handleToggleReminder(item)}
            >
              <Card
                style={[
                  styles.reminderCard,
                  item.is_done && styles.reminderCardDone,
                ]}
              >
                <View style={styles.reminderRow}>
                  <TouchableOpacity
                    style={styles.checkboxTouch}
                    onPress={() => handleToggleReminder(item)}
                  >
                    {item.is_done ? (
                      <CheckCircle2 size={26} color={colors.success} />
                    ) : (
                      <Circle size={26} color={colors.borderDark} />
                    )}
                  </TouchableOpacity>

                  <View style={styles.reminderInfo}>
                    <Text
                      style={[
                        styles.reminderTitle,
                        item.is_done && styles.reminderTitleDone,
                      ]}
                    >
                      {item.title}
                    </Text>
                    <View style={styles.reminderMetaRow}>
                      <Clock size={14} color={colors.textMuted} />
                      <Text style={styles.reminderTimeText}>
                        {item.reminder_time.slice(0, 5)}
                      </Text>
                      {item.dosage ? (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Pill size={14} color={colors.primary} />
                          <Text style={styles.reminderDosageText}>
                            {item.dosage}
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>

                  <Badge
                    label={item.is_done ? "Done" : "Pending"}
                    variant={item.is_done ? "success" : "warning"}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        {/* Quick Action Buttons */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primaryLight }]}
            onPress={() => router.push("/(patient)/upload")}
          >
            <Camera size={26} color={colors.primary} />
            <Text style={[styles.actionCardTitle, { color: colors.primaryDark }]}>
              Scan Medicine
            </Text>
            <Text style={styles.actionCardSubtitle}>
              Photograph pill bottle or prescription
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.secondaryLight }]}
            onPress={handleCallCaregiver}
          >
            <Phone size={26} color={colors.secondary} />
            <Text style={[styles.actionCardTitle, { color: colors.secondary }]}>
              Call Caregiver
            </Text>
            <Text style={styles.actionCardSubtitle}>
              {patient?.caretaker?.name || "One-tap assistance"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent Memories Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Memories</Text>
          <TouchableOpacity onPress={() => router.push("/(patient)/memories")}>
            <Text style={styles.seeAllText}>Timeline</Text>
          </TouchableOpacity>
        </View>

        {memories.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Brain size={32} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No memories recorded yet</Text>
            <Text style={styles.emptyMessage}>
              Chat with your assistant to automatically record object locations and facts.
            </Text>
          </Card>
        ) : (
          memories.map((mem) => (
            <TouchableOpacity
              key={mem.id}
              activeOpacity={0.8}
              onPress={() => router.push(`/(patient)/memories/${mem.id}` as any)}
            >
              <Card style={styles.memoryCard}>
                <View style={styles.memoryRow}>
                  <View style={styles.memoryIconCircle}>
                    <Text style={styles.memoryEmoji}>
                      {mem.memory_type === "OBJECT_LOCATION"
                        ? "📍"
                        : mem.memory_type === "MEDICATION"
                        ? "💊"
                        : "💭"}
                    </Text>
                  </View>
                  <View style={styles.memoryDetails}>
                    <Text style={styles.memoryTitle}>{mem.title}</Text>
                    <Text style={styles.memoryContent} numberOfLines={1}>
                      {mem.content || mem.description}
                    </Text>
                  </View>
                  <Badge
                    label={`${mem.confidence ? Math.round(mem.confidence * 100) : 95}%`}
                    variant="neutral"
                  />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
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
    padding: 20,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
  },
  assistantBanner: {
    backgroundColor: colors.primary,
    borderRadius: 22,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  assistantBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  assistantIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  assistantTextWrap: {
    flex: 1,
  },
  assistantTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#ffffff",
  },
  assistantSubtitle: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.88)",
    marginTop: 3,
    lineHeight: 16,
  },
  progressCard: {
    padding: 18,
    marginBottom: 22,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  cardSubheading: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  progressPercentText: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primary,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  reminderCard: {
    padding: 14,
    marginBottom: 8,
  },
  reminderCardDone: {
    opacity: 0.65,
    backgroundColor: "#f8fafc",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxTouch: {
    padding: 4,
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
    marginRight: 10,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  reminderTitleDone: {
    textDecorationLine: "line-through",
    color: colors.textSecondary,
  },
  reminderMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  reminderTimeText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  metaDot: {
    marginHorizontal: 6,
    color: colors.textMuted,
  },
  reminderDosageText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: "500",
    marginLeft: 4,
  },
  actionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 18,
  },
  actionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    marginHorizontal: 4,
  },
  actionCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 10,
  },
  actionCardSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  memoryCard: {
    padding: 14,
    marginBottom: 8,
  },
  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  memoryEmoji: {
    fontSize: 20,
  },
  memoryDetails: {
    flex: 1,
    marginRight: 10,
  },
  memoryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  memoryContent: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 10,
  },
  emptyMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
});
