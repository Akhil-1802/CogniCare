import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  Send,
  Camera,
  Image as ImageIcon,
  Bot,
  User,
  Wrench,
  AlertCircle,
  HelpCircle,
  CheckCircle,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";
import { Header } from "../../src/components/ui/Header";
import { Card } from "../../src/components/ui/Card";
import { Badge } from "../../src/components/ui/Badge";
import { Button } from "../../src/components/ui/Button";
import { AssistantApi, AssistantChatResponse } from "../../src/api/assistant";
import type { ChatMessage, DetectedMedicineInfo } from "../../src/types";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  get_today_medicines: "Checked medicine schedule",
  get_upcoming_appointments: "Checked appointments",
  get_patient_reminders: "Checked reminders",
  get_patient_routine: "Checked daily routine",
  save_to_routine: "Saved to daily routine",
  search_patient_memories: "Searched long-term memories",
  search_patient_documents: "Searched documents",
  create_reminder: "Created a reminder",
};

export default function AssistantScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your CogniCare assistant. You can ask me where you placed an item, check today's medicine, or take a picture of a medicine bottle.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res: AssistantChatResponse = await AssistantApi.chat(text, conversationId);
      if (res.conversation_id) setConversationId(res.conversation_id);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tools_used: res.tools_used,
        detected_medicine: res.detected_medicine,
        disclaimer: res.disclaimer,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Sorry, I had trouble reaching the care assistant server. Please check your connection.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async (useCamera = false) => {
    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Needed", "Camera access is needed to scan medicine.");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission Needed", "Photo library access is needed.");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.8,
        });
      }

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        await sendFileMessage(asset.uri, asset.fileName || "medicine_scan.jpg", asset.mimeType || "image/jpeg");
      }
    } catch (e: any) {
      Alert.alert("Capture Error", e.message || "Failed to capture image.");
    }
  };

  const sendFileMessage = async (uri: string, name: string, mime: string) => {
    setLoading(true);
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: "📷 [Attached Medicine Image]",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await AssistantApi.chatWithFile(
        uri,
        name,
        mime,
        "What is this medicine and when should I take it?",
        conversationId
      );
      if (res.conversation_id) setConversationId(res.conversation_id);

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.response,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        tools_used: res.tools_used,
        detected_medicine: res.detected_medicine,
        disclaimer: res.disclaimer,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      Alert.alert("OCR Error", err.response?.data?.detail || "Could not analyze the medicine image.");
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (question: string) => {
    try {
      await AssistantApi.escalateQuestion(question, conversationId);
      Alert.alert(
        "Escalated to Caregiver",
        "Your question has been sent to your caregiver. You will be notified once they respond."
      );
    } catch {
      Alert.alert("Error", "Could not send inquiry to caregiver.");
    }
  };

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";

    return (
      <View
        style={[
          styles.messageRow,
          isUser ? styles.messageRowUser : styles.messageRowAssistant,
        ]}
      >
        {!isUser ? (
          <View style={styles.assistantAvatar}>
            <Bot size={18} color={colors.primary} />
          </View>
        ) : null}

        <View style={styles.messageBubbleWrap}>
          {/* Tool execution pills */}
          {!isUser && item.tools_used && item.tools_used.length > 0 ? (
            <View style={styles.toolsRow}>
              {item.tools_used.map((t, idx) => (
                <View key={idx} style={styles.toolBadge}>
                  <Wrench size={11} color={colors.primary} />
                  <Text style={styles.toolBadgeText}>
                    {TOOL_DESCRIPTIONS[t] || t}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View
            style={[
              styles.bubble,
              isUser ? styles.userBubble : styles.assistantBubble,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userText : styles.assistantText,
              ]}
            >
              {item.content}
            </Text>
            <Text
              style={[
                styles.timeText,
                isUser ? styles.timeTextUser : styles.timeTextAssistant,
              ]}
            >
              {item.timestamp}
            </Text>
          </View>

          {/* Detected Medicine Card */}
          {item.detected_medicine ? (
            <Card style={styles.medicineCard}>
              <View style={styles.medicineHeaderRow}>
                <CheckCircle size={18} color={colors.success} />
                <Text style={styles.medicineCardTitle}>
                  {item.detected_medicine.detected_name}
                </Text>
                <Badge
                  label={item.detected_medicine.status}
                  variant={
                    item.detected_medicine.status === "VERIFIED"
                      ? "success"
                      : "warning"
                  }
                />
              </View>

              {item.detected_medicine.detected_dosage ? (
                <Text style={styles.medicineDosage}>
                  Dosage: {item.detected_medicine.detected_dosage}
                </Text>
              ) : null}

              {item.detected_medicine.timing ? (
                <Text style={styles.medicineTiming}>
                  Schedule: {item.detected_medicine.timing}
                </Text>
              ) : null}

              {item.detected_medicine.advisory ? (
                <Text style={styles.medicineAdvisory}>
                  {item.detected_medicine.advisory}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {/* Disclaimer if present */}
          {item.disclaimer ? (
            <Text style={styles.disclaimerText}>{item.disclaimer}</Text>
          ) : null}
        </View>

        {isUser ? (
          <View style={styles.userAvatar}>
            <User size={18} color="#ffffff" />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="CogniCare Assistant"
        subtitle="AI Voice & Memory Agent"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={styles.chatContainer}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {loading ? (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.typingText}>Thinking & checking records...</Text>
          </View>
        ) : null}

        {/* Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => handlePickImage(true)}
          >
            <Camera size={22} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => handlePickImage(false)}
          >
            <ImageIcon size={22} color={colors.textSecondary} />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask about memories or medicines..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              !inputText.trim() || loading ? styles.sendBtnDisabled : null,
            ]}
            onPress={() => sendMessage()}
            disabled={!inputText.trim() || loading}
          >
            <Send size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  chatContainer: {
    flex: 1,
  },
  messageList: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
  },
  messageRowAssistant: {
    justifyContent: "flex-start",
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  messageBubbleWrap: {
    maxWidth: "80%",
  },
  bubble: {
    padding: 14,
    borderRadius: 18,
  },
  assistantBubble: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  assistantText: {
    color: colors.textPrimary,
  },
  userText: {
    color: colors.textInverse,
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: "right",
  },
  timeTextAssistant: {
    color: colors.textMuted,
  },
  timeTextUser: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  toolsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  toolBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  toolBadgeText: {
    fontSize: 11,
    color: colors.primaryDark,
    marginLeft: 4,
    fontWeight: "600",
  },
  medicineCard: {
    marginTop: 8,
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  medicineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  medicineCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
    flex: 1,
    marginLeft: 6,
  },
  medicineDosage: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  medicineTiming: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  medicineAdvisory: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
    marginTop: 4,
  },
  disclaimerText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
    fontStyle: "italic",
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  attachBtn: {
    padding: 8,
    marginRight: 4,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
    color: colors.textPrimary,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  sendBtnDisabled: {
    backgroundColor: colors.borderDark,
    opacity: 0.6,
  },
});
