import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Brain,
  Check,
  X,
  MessageSquare,
  Sparkles,
  ShieldAlert,
  ChevronDown,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { useAuth } from "../../src/context/AuthContext";
import { AssistantApi } from "../../src/api/assistant";
import type { AiActivity, Memory } from "../../src/types";

export default function CaregiverAiActivityScreen() {
  const { patients, selectedPatient, setSelectedPatient } = useAuth();

  const [activity, setActivity] = useState<AiActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadActivity = useCallback(async () => {
    if (!selectedPatient) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const data = await AssistantApi.getAiActivity(selectedPatient.id);
      setActivity(data);
    } catch {
      setActivity(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPatient]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivity();
  };

  const handleValidate = async (memoryId: string, status: "ACTIVE" | "REJECTED") => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    setActioningId(memoryId);
    try {
      await AssistantApi.validateMemory(memoryId, status);
      // Remove from pending list
      setActivity((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pending_validation: prev.pending_validation.filter((m) => m.id !== memoryId),
        };
      });
      Alert.alert(
        status === "ACTIVE" ? "Memory Approved" : "Memory Rejected",
        status === "ACTIVE"
          ? "The fact has been saved into the patient's long-term knowledge base."
          : "The candidate was dismissed and won't be recalled."
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Could not update memory.");
    } finally {
      setActioningId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="AI Activity & Audits"
        subtitle={selectedPatient ? `Patient: ${selectedPatient.name}` : "Select a patient"}
      />

      {/* Patient Picker horizontal chips */}
      {patients.length > 1 ? (
        <View style={styles.pickerContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {patients.map((p) => {
              const isSelected = selectedPatient?.id === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.pickerChip, isSelected && styles.pickerChipActive]}
                  onPress={() => setSelectedPatient(p)}
                >
                  <Text
                    style={[
                      styles.pickerChipText,
                      isSelected && styles.pickerChipTextActive,
                    ]}
                  >
                    {p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

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
        {!selectedPatient ? (
          <EmptyState
            icon={<Brain size={36} color={colors.primary} />}
            title="No Patient Selected"
            message="Add or select a patient to audit AI interactions."
          />
        ) : (
          <>
            {/* Daily AI Summary Card */}
            {activity?.daily_summary ? (
              <Card style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Sparkles size={20} color={colors.primary} />
                  <Text style={styles.summaryTitle}>Daily AI Summary</Text>
                </View>
                <Text style={styles.summaryText}>
                  {activity.daily_summary.summary}
                </Text>

                {activity.daily_summary.important_events?.length > 0 ? (
                  <View style={styles.eventsList}>
                    <Text style={styles.eventsHeading}>Important Events:</Text>
                    {activity.daily_summary.important_events.map((ev, i) => (
                      <Text key={i} style={styles.eventBullet}>
                        • {ev}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </Card>
            ) : null}

            {/* Pending Validation Section */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>
                Pending Validation ({activity?.pending_validation?.length || 0})
              </Text>
            </View>

            {(!activity?.pending_validation || activity.pending_validation.length === 0) ? (
              <Card style={styles.emptyValidationCard}>
                <Text style={styles.emptyValidationText}>
                  No memory candidates pending approval for this patient.
                </Text>
              </Card>
            ) : (
              activity.pending_validation.map((mem) => {
                const isWorking = actioningId === mem.id;
                return (
                  <Card key={mem.id} style={styles.validationCard}>
                    <View style={styles.valHeader}>
                      <Badge
                        label={mem.memory_type || "Memory Candidate"}
                        variant="warning"
                      />
                      <Badge
                        label={`Confidence ${mem.confidence ? Math.round(mem.confidence * 100) : 85}%`}
                        variant="neutral"
                      />
                    </View>

                    <Text style={styles.valTitle}>{mem.title}</Text>
                    <Text style={styles.valContent}>
                      {mem.content || mem.description}
                    </Text>

                    {mem.metadata?.reason ? (
                      <Text style={styles.valReason}>
                        Extraction Reason: {mem.metadata.reason}
                      </Text>
                    ) : null}

                    {/* Action Buttons */}
                    <View style={styles.valActionRow}>
                      <Button
                        title="Reject"
                        variant="outline"
                        size="sm"
                        icon={<X size={16} color={colors.danger} />}
                        onPress={() => handleValidate(mem.id, "REJECTED")}
                        disabled={isWorking}
                        style={styles.valBtn}
                        textStyle={{ color: colors.danger }}
                      />
                      <Button
                        title="Approve & Store"
                        variant="primary"
                        size="sm"
                        icon={<Check size={16} color="#ffffff" />}
                        onPress={() => handleValidate(mem.id, "ACTIVE")}
                        loading={isWorking}
                        style={styles.valBtn}
                      />
                    </View>
                  </Card>
                );
              })
            )}

            {/* Recent Conversations Audit */}
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent AI Conversations</Text>
            </View>

            {(!activity?.recent_conversations || activity.recent_conversations.length === 0) ? (
              <Card style={styles.emptyValidationCard}>
                <Text style={styles.emptyValidationText}>
                  No recent conversation logs found.
                </Text>
              </Card>
            ) : (
              activity.recent_conversations.map((conv) => (
                <Card key={conv.id} style={styles.conversationCard}>
                  <View style={styles.convHeader}>
                    <MessageSquare size={16} color={colors.primary} />
                    <Text style={styles.convTime}>
                      {new Date(conv.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <Text style={styles.convPreview}>
                    {conv.preview || "Patient conversation session"}
                  </Text>
                </Card>
              ))
            )}
          </>
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
  pickerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    marginRight: 8,
  },
  pickerChipActive: {
    backgroundColor: colors.primary,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  pickerChipTextActive: {
    color: "#ffffff",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    padding: 18,
    backgroundColor: "#f0f9ff",
    borderColor: "#bae6fd",
    marginBottom: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryDark,
    marginLeft: 6,
  },
  summaryText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  eventsList: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0f2fe",
  },
  eventsHeading: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryDark,
    marginBottom: 4,
  },
  eventBullet: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  emptyValidationCard: {
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyValidationText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  validationCard: {
    padding: 18,
    marginBottom: 12,
  },
  valHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  valTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  valContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 4,
  },
  valReason: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 8,
  },
  valActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  valBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
  conversationCard: {
    padding: 14,
    marginBottom: 8,
  },
  convHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  convTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginLeft: 6,
  },
  convPreview: {
    fontSize: 14,
    color: colors.textPrimary,
  },
});
