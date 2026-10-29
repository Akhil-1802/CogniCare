import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  HeartPulse,
  Mail,
  Lock,
  User,
  Settings,
  ShieldCheck,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { Card } from "../../src/components/ui/Card";
import { getApiBaseUrl, setApiBaseUrl } from "../../src/utils/network";

export default function LoginScreen() {
  const router = useRouter();
  const { caregiverLogin, patientLogin } = useAuth();

  const [role, setRole] = useState<"CareTaker" | "Patient">("CareTaker");
  const [loading, setLoading] = useState(false);

  // Caretaker fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Patient fields
  const [patientId, setPatientId] = useState("PAT-1E0BB4");
  const [patientPassword, setPatientPassword] = useState("12345678");

  // Server Settings Modal
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl);
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (role === "CareTaker") {
        if (!email.trim() || !password.trim()) {
          Alert.alert("Missing fields", "Please enter both email and password.");
          setLoading(false);
          return;
        }
        await caregiverLogin(email.trim(), password);
        router.replace("/(caregiver)");
      } else {
        if (!patientId.trim() || !patientPassword.trim()) {
          Alert.alert("Missing fields", "Please enter your Patient ID and Password.");
          setLoading(false);
          return;
        }
        await patientLogin(patientId.trim(), patientPassword);
        router.replace("/(patient)");
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Login failed";
      if (msg === "Please verify your email first") {
        router.push({
          pathname: "/(auth)/verify",
          params: { email: email.trim() },
        });
      } else {
        Alert.alert("Sign In Error", msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServerUrl = () => {
    if (serverUrl.trim()) {
      setApiBaseUrl(serverUrl.trim());
      Alert.alert("Server Updated", `Backend URL set to:\n${serverUrl.trim()}`);
      setShowServerModal(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header branding */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <HeartPulse size={36} color={colors.primary} />
            </View>
            <Text style={styles.title}>CogniCare</Text>
            <Text style={styles.subtitle}>
              Intelligent Cognitive Support & Caregiver Coordination
            </Text>
          </View>

          {/* Role Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, role === "CareTaker" && styles.activeTab]}
              onPress={() => setRole("CareTaker")}
            >
              <Text
                style={[
                  styles.tabText,
                  role === "CareTaker" && styles.activeTabText,
                ]}
              >
                Caregiver
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, role === "Patient" && styles.activeTab]}
              onPress={() => setRole("Patient")}
            >
              <Text
                style={[
                  styles.tabText,
                  role === "Patient" && styles.activeTabText,
                ]}
              >
                Patient
              </Text>
            </TouchableOpacity>
          </View>

          <Card style={styles.card}>
            {role === "CareTaker" ? (
              // Caregiver Form
              <View>
                <Text style={styles.formTitle}>Caregiver Portal</Text>
                <Text style={styles.formSubtitle}>
                  Monitor patient activities, reminders, and health records
                </Text>

                <Input
                  label="Email Address"
                  placeholder="name@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  icon={<Mail size={20} color={colors.textMuted} />}
                />

                <Input
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  icon={<Lock size={20} color={colors.textMuted} />}
                />

                <Button
                  title="Sign In as Caregiver"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.submitButton}
                />

                <View style={styles.registerRow}>
                  <Text style={styles.registerText}>Don't have an account? </Text>
                  <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                    <Text style={styles.registerLink}>Sign up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Patient Form
              <View>
                <Text style={styles.formTitle}>Patient Portal</Text>
                <Text style={styles.formSubtitle}>
                  Enter the Patient ID provided by your caregiver
                </Text>

                <Input
                  label="Patient ID"
                  placeholder="e.g. PAT-1E0BB4"
                  value={patientId}
                  onChangeText={setPatientId}
                  autoCapitalize="characters"
                  icon={<User size={20} color={colors.textMuted} />}
                />

                <Input
                  label="Password"
                  placeholder="••••••••"
                  value={patientPassword}
                  onChangeText={setPatientPassword}
                  secureTextEntry
                  icon={<Lock size={20} color={colors.textMuted} />}
                />

                <Button
                  title="Sign In as Patient"
                  onPress={handleLogin}
                  loading={loading}
                  style={styles.submitButton}
                />

                <View style={styles.patientNotice}>
                  <ShieldCheck size={18} color={colors.secondary} />
                  <Text style={styles.noticeText}>
                    Need an ID? Ask your registered caregiver to add you from their dashboard.
                  </Text>
                </View>
              </View>
            )}
          </Card>

          {/* Server Settings Button (Helps physical device testing) */}
          <TouchableOpacity
            style={styles.serverButton}
            onPress={() => setShowServerModal(true)}
          >
            <Settings size={16} color={colors.textMuted} />
            <Text style={styles.serverButtonText}>
              Backend: {serverUrl || "Resolving..."}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Backend URL Modal */}
      <Modal
        visible={showServerModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowServerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Backend Server URL</Text>
            <Text style={styles.modalSubtitle}>
              Connected to 24/7 cloud backend: https://cognicare-qrmx.onrender.com. You can change this if testing against a custom server.
            </Text>

            <Input
              value={serverUrl}
              onChangeText={setServerUrl}
              placeholder="https://cognicare-qrmx.onrender.com"
              autoCapitalize="none"
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowServerModal(false)}
                style={styles.modalBtn}
              />
              <Button
                title="Save & Apply"
                onPress={handleSaveServerUrl}
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
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
    marginTop: 10,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    paddingHorizontal: 20,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: colors.cardBackground,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.primary,
  },
  card: {
    padding: 22,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 4,
  },
  formSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 18,
  },
  submitButton: {
    marginTop: 18,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  registerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  patientNotice: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.secondaryLight,
    borderRadius: 12,
    padding: 12,
    marginTop: 18,
  },
  noticeText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    color: colors.secondary,
    lineHeight: 16,
  },
  serverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    padding: 8,
  },
  serverButtonText: {
    marginLeft: 6,
    fontSize: 12,
    color: colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.cardBackground,
    borderRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
});
