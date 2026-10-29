import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, CheckCheck, Clock, MessageSquare } from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { NotificationsApi } from "../../src/api/notifications";
import type { NotificationItem } from "../../src/types";

export default function PatientNotificationsScreen() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await NotificationsApi.getPatientNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const markRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, patient_read: true } : n))
    );
    try {
      await NotificationsApi.markNotificationRead(id);
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Notifications & Inquiries" showBack />

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
            title="All Caught Up"
            message="No active caregiver replies or alerts at this moment."
          />
        ) : (
          notifications.map((item) => (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.8}
              onPress={() => markRead(item.id)}
            >
              <Card
                style={[
                  styles.notifCard,
                  !item.patient_read && styles.unreadCard,
                ]}
              >
                <View style={styles.headerRow}>
                  <View style={styles.typeBadgeRow}>
                    <Badge
                      label={item.status === "answered" ? "Replied" : "Pending"}
                      variant={item.status === "answered" ? "success" : "warning"}
                    />
                    {!item.patient_read ? (
                      <View style={styles.unreadDot} />
                    ) : null}
                  </View>
                  <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                </View>

                <Text style={styles.questionText}>{item.question}</Text>

                {item.response ? (
                  <View style={styles.responseBox}>
                    <Text style={styles.responseHeading}>Caregiver Response:</Text>
                    <Text style={styles.responseText}>{item.response}</Text>
                  </View>
                ) : null}
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
    padding: 16,
    paddingBottom: 40,
  },
  notifCard: {
    padding: 16,
    marginBottom: 10,
  },
  unreadCard: {
    borderColor: colors.primaryMuted,
    backgroundColor: "#f0f9ff",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  responseBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  responseHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
    marginBottom: 2,
  },
  responseText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});
