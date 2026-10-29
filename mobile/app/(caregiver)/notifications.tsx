import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Bell,
  Send,
  CheckCircle2,
  Clock,
  MessageCircle,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { NotificationsApi } from "../../src/api/notifications";
import type { NotificationItem } from "../../src/types";

export default function CaregiverNotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Map of active reply text per notification
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await NotificationsApi.getCaretakerNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleReplyChange = (id: string, text: string) => {
    setReplyInputs((prev) => ({ ...prev, [id]: text }));
  };

  const handleSubmitResponse = async (item: NotificationItem) => {
    const text = (replyInputs[item.id] || "").trim();
    if (!text) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setSubmittingId(item.id);
    try {
      await NotificationsApi.respondToNotification(item.id, text, item.category);

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === item.id ? { ...n, status: "answered", response: text } : n
        )
      );
      setReplyInputs((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });

      Alert.alert(
        "Response Sent",
        "Your reply was delivered to the patient and embedded into their long-term memory."
      );
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Could not submit response.");
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Patient Alerts & Inquiries"
        subtitle="Questions escalated from AI or asked by patients"
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
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell size={36} color={colors.primary} />}
            title="No Pending Questions"
            message="Your patients have not submitted any questions or escalations."
          />
        ) : (
          notifications.map((item) => {
            const isAnswered = item.status === "answered";
            const isWorking = submittingId === item.id;
            const replyText = replyInputs[item.id] || "";

            return (
              <Card
                key={item.id}
                style={[
                  styles.itemCard,
                  !isAnswered && styles.unansweredCard,
                ]}
              >
                <View style={styles.cardHeader}>
                  <Badge
                    label={isAnswered ? "Answered" : "Needs Response"}
                    variant={isAnswered ? "success" : "warning"}
                  />
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>

                {item.metadata?.patient_name ? (
                  <Text style={styles.patientName}>
                    From: {item.metadata.patient_name}
                  </Text>
                ) : null}

                <Text style={styles.questionText}>"{item.question}"</Text>

                {isAnswered && item.response ? (
                  <View style={styles.answeredBox}>
                    <CheckCircle2 size={16} color={colors.success} />
                    <Text style={styles.answeredText}>{item.response}</Text>
                  </View>
                ) : (
                  <View style={styles.replyForm}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Type your answer to patient..."
                      placeholderTextColor={colors.textMuted}
                      value={replyText}
                      onChangeText={(t) => handleReplyChange(item.id, t)}
                      multiline
                    />
                    <Button
                      title="Send Response"
                      size="sm"
                      icon={<Send size={15} color="#ffffff" />}
                      onPress={() => handleSubmitResponse(item)}
                      loading={isWorking}
                      disabled={!replyText.trim() || isWorking}
                      style={styles.sendBtn}
                    />
                  </View>
                )}
              </Card>
            );
          })
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
    padding: 16,
    paddingBottom: 40,
  },
  itemCard: {
    padding: 18,
    marginBottom: 12,
  },
  unansweredCard: {
    borderColor: colors.warning,
    backgroundColor: "#fffdfa",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  patientName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
    marginBottom: 4,
  },
  questionText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    lineHeight: 22,
  },
  answeredBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  answeredText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  replyForm: {
    marginTop: 14,
  },
  replyInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 70,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  sendBtn: {
    alignSelf: "flex-end",
  },
});
