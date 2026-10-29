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
import { useRouter } from "expo-router";
import {
  Users,
  Brain,
  Bell,
  Plus,
  FileUp,
  LogOut,
  ChevronRight,
  Activity,
  CalendarCheck,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { NotificationsApi } from "../../src/api/notifications";
import { MemoriesApi } from "../../src/api/memories";
import { RemindersApi, todayISO } from "../../src/api/reminders";
import type { Patient, Reminder, Memory } from "../../src/types";

export default function CaregiverDashboard() {
  const router = useRouter();
  const { user, patients, selectedPatient, setSelectedPatient, refreshPatients, logout } =
    useAuth();

  const [notificationCounts, setNotificationCounts] = useState<{
    pending_questions?: number;
    unread_answers?: number;
  }>({});
  const [pendingMemories, setPendingMemories] = useState<Memory[]>([]);
  const [patientReminders, setPatientReminders] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await refreshPatients();
      const counts = await NotificationsApi.getCounts().catch(() => ({}));
      setNotificationCounts(counts);

      if (selectedPatient) {
        const [rems, mems] = await Promise.all([
          RemindersApi.fetchPatientReminders(selectedPatient.id, todayISO()).catch(() => []),
          MemoriesApi.listPendingMemories(selectedPatient.id).catch(() => []),
        ]);
        setPatientReminders(rems);
        setPendingMemories(mems);
      }
    } finally {
      setRefreshing(false);
    }
  }, [selectedPatient, refreshPatients]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const completedReminders = patientReminders.filter((r) => r.is_done).length;

  return (
    <SafeAreaView style={styles.safeArea}>
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
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>
              Welcome, {user?.name || "Caregiver"}
            </Text>
            <Text style={styles.subtitle}>Caregiver Coordination Hub</Text>
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

        {/* Metric Cards Row */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: colors.primaryLight }]}
            onPress={() => router.push("/(caregiver)/patients" as any)}
          >
            <Users size={22} color={colors.primary} />
            <Text style={styles.metricNumber}>{patients.length}</Text>
            <Text style={styles.metricLabel}>Total Patients</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: colors.warningLight }]}
            onPress={() => router.push("/(caregiver)/activity" as any)}
          >
            <Brain size={22} color={colors.warning} />
            <Text style={styles.metricNumber}>{pendingMemories.length}</Text>
            <Text style={styles.metricLabel}>Pending Reviews</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: colors.dangerLight }]}
            onPress={() => router.push("/(caregiver)/notifications" as any)}
          >
            <Bell size={22} color={colors.danger} />
            <Text style={styles.metricNumber}>
              {notificationCounts.pending_questions || 0}
            </Text>
            <Text style={styles.metricLabel}>Inquiries</Text>
          </TouchableOpacity>
        </View>

        {/* Patient Switcher Chips */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Active Patient</Text>
          <TouchableOpacity
            onPress={() => router.push("/(caregiver)/patients" as any)}
          >
            <Text style={styles.seeAllText}>Manage All</Text>
          </TouchableOpacity>
        </View>

        {patients.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No linked patients</Text>
            <Text style={styles.emptySub}>
              Add your first patient to manage routines and monitor AI activity.
            </Text>
            <Button
              title="Add Patient"
              icon={<Plus size={18} color="#ffffff" />}
              onPress={() => router.push("/(caregiver)/patients" as any)}
              style={styles.emptyBtn}
            />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            {patients.map((p) => {
              const isSelected = selectedPatient?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.patientChip,
                    isSelected && styles.patientChipSelected,
                  ]}
                  onPress={() => setSelectedPatient(p)}
                >
                  <Text
                    style={[
                      styles.patientChipName,
                      isSelected && styles.patientChipNameSelected,
                    ]}
                  >
                    {p.name}
                  </Text>
                  <Text
                    style={[
                      styles.patientChipId,
                      isSelected && styles.patientChipIdSelected,
                    ]}
                  >
                    {p.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Active Patient Snapshot Card */}
        {selectedPatient ? (
          <Card style={styles.snapshotCard}>
            <View style={styles.snapshotHeader}>
              <View>
                <Text style={styles.snapshotPatientName}>
                  {selectedPatient.name}
                </Text>
                <Text style={styles.snapshotDetails}>
                  {selectedPatient.location || "Home"} • ID: {selectedPatient.id}
                </Text>
              </View>
              <Badge
                label={`${completedReminders}/${patientReminders.length} Done`}
                variant="success"
              />
            </View>

            {/* Quick action buttons for active patient */}
            <View style={styles.snapshotActions}>
              <Button
                title="Prescription Scanner"
                variant="outline"
                size="sm"
                icon={<FileUp size={16} color={colors.textPrimary} />}
                onPress={() => router.push("/(caregiver)/upload" as any)}
                style={styles.snapshotBtn}
              />
              <Button
                title="Manage Routine"
                variant="primary"
                size="sm"
                icon={<CalendarCheck size={16} color="#ffffff" />}
                onPress={() =>
                  router.push(
                    `/(caregiver)/patients/${selectedPatient.id}` as any
                  )
                }
                style={styles.snapshotBtn}
              />
            </View>
          </Card>
        ) : null}

        {/* Quick Review Alert if pending items */}
        {pendingMemories.length > 0 ? (
          <TouchableOpacity
            style={styles.reviewBanner}
            onPress={() => router.push("/(caregiver)/activity" as any)}
          >
            <View style={styles.reviewBannerLeft}>
              <View style={styles.reviewIconCircle}>
                <Brain size={22} color={colors.warning} />
              </View>
              <View style={styles.reviewTextWrap}>
                <Text style={styles.reviewTitle}>
                  {pendingMemories.length} Memories Awaiting Approval
                </Text>
                <Text style={styles.reviewSub}>
                  Review newly extracted object locations and preferences.
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    padding: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
  },
  metricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    marginHorizontal: 4,
    alignItems: "center",
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
    marginTop: 6,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
  chipScroll: {
    marginBottom: 16,
  },
  patientChip: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
  },
  patientChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  patientChipName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  patientChipNameSelected: {
    color: "#ffffff",
  },
  patientChipId: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  patientChipIdSelected: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  snapshotCard: {
    padding: 18,
    marginBottom: 20,
  },
  snapshotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  snapshotPatientName: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  snapshotDetails: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  snapshotActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  snapshotBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  reviewBanner: {
    backgroundColor: colors.warningLight,
    borderColor: "#fde68a",
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reviewIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  reviewTextWrap: {
    flex: 1,
  },
  reviewTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  reviewSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  emptyBtn: {
    paddingHorizontal: 24,
  },
});
