import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  HeartHandshake,
  Phone,
  Mail,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { Badge } from "../../src/components/ui/Badge";
import { useAuth } from "../../src/context/AuthContext";
import { NotificationsApi } from "../../src/api/notifications";
import type { Patient, NotificationItem } from "../../src/types";

export default function ConnectedCaregiverScreen() {
  const { user } = useAuth();
  const patient = user as Patient | null;
  const caregiver = patient?.caretaker;

  const [inquiries, setInquiries] = useState<NotificationItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadInquiries();
  }, []);

  const loadInquiries = async () => {
    try {
      const data = await NotificationsApi.getPatientNotifications();
      setInquiries(data);
    } catch {
      setInquiries([]);
    }
  };

  const handleCall = () => {
    if (caregiver?.phone) {
      Linking.openURL(`tel:${caregiver.phone}`);
    } else {
      Alert.alert("No Phone Number", "No phone number registered for this caregiver.");
    }
  };

  const handleEmail = () => {
    if (caregiver?.email) {
      Linking.openURL(`mailto:${caregiver.email}`);
    }
  };

  const handleSendInquiry = async () => {
    if (!questionText.trim()) return;
    setSubmitting(true);

    try {
      await NotificationsApi.sendInquiry(questionText.trim(), "general");
      setQuestionText("");
      setModalVisible(false);
      Alert.alert("Inquiry Sent", "Your question has been sent to your caregiver.");
      loadInquiries();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.detail || "Failed to send inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Connected Caregiver"
        subtitle="Direct support & communication"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Caregiver Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.avatarWrap}>
            <HeartHandshake size={36} color={colors.primary} />
          </View>
          <Text style={styles.caregiverName}>
            {caregiver?.name || "Assigned Caregiver"}
          </Text>
          <Text style={styles.relationshipText}>
            {caregiver?.relationship || "Primary Care Coordinator"}
          </Text>

          <View style={styles.contactRow}>
            {caregiver?.phone ? (
              <TouchableOpacity style={styles.contactBtn} onPress={handleCall}>
                <Phone size={18} color="#ffffff" />
                <Text style={styles.contactBtnText}>Call Now</Text>
              </TouchableOpacity>
            ) : null}

            {caregiver?.email ? (
              <TouchableOpacity
                style={[styles.contactBtn, styles.emailBtn]}
                onPress={handleEmail}
              >
                <Mail size={18} color={colors.primary} />
                <Text style={styles.emailBtnText}>Send Email</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        {/* Ask Question Card */}
        <Card style={styles.askCard}>
          <View style={styles.askRow}>
            <View style={styles.askIconCircle}>
              <MessageCircle size={24} color={colors.secondary} />
            </View>
            <View style={styles.askTextWrap}>
              <Text style={styles.askTitle}>Need clarification?</Text>
              <Text style={styles.askSub}>
                Send a question directly to your caregiver's notification feed.
              </Text>
            </View>
          </View>
          <Button
            title="Ask a Question"
            variant="secondary"
            onPress={() => setModalVisible(true)}
            style={styles.askBtn}
          />
        </Card>

        {/* Inquiry History */}
        <Text style={styles.sectionTitle}>Inquiries & Replies</Text>

        {inquiries.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No previous inquiries with your caregiver.</Text>
          </Card>
        ) : (
          inquiries.map((inq) => (
            <Card key={inq.id} style={styles.inquiryCard}>
              <View style={styles.inquiryHeader}>
                <Badge
                  label={inq.status === "answered" ? "Answered" : "Pending"}
                  variant={inq.status === "answered" ? "success" : "warning"}
                />
                <Text style={styles.inquiryDate}>
                  {new Date(inq.created_at).toLocaleDateString([], {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>

              <Text style={styles.questionText}>Q: {inq.question}</Text>

              {inq.response ? (
                <View style={styles.replyBox}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={styles.replyText}>
                    Reply: {inq.response}
                  </Text>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Ask Question Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Ask Your Caregiver</Text>
            <Text style={styles.modalSubtitle}>
              Type your question below. They will receive an instant alert on their dashboard.
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g., Can I take my medication before lunch?"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              value={questionText}
              onChangeText={setQuestionText}
            />

            <View style={styles.modalBtnRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setModalVisible(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Send Question"
                onPress={handleSendInquiry}
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
  heroCard: {
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  caregiverName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  relationshipText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    marginTop: 18,
    width: "100%",
    justifyContent: "center",
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginHorizontal: 6,
    flex: 1,
  },
  contactBtnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
  emailBtn: {
    backgroundColor: colors.primaryLight,
  },
  emailBtnText: {
    color: colors.primaryDark,
    fontWeight: "700",
    fontSize: 14,
    marginLeft: 6,
  },
  askCard: {
    padding: 18,
    marginBottom: 20,
  },
  askRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  askIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.secondaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  askTextWrap: {
    flex: 1,
  },
  askTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  askSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  askBtn: {
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  inquiryCard: {
    padding: 16,
    marginBottom: 10,
  },
  inquiryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  inquiryDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  questionText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  replyBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
  },
  replyText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
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
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 14,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 100,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
});
