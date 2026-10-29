import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ShieldCheck, Mail, ArrowLeft, RefreshCw } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { Card } from "../../src/components/ui/Card";

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { verifyEmail, resendCode } = useAuth();

  const [email, setEmail] = useState(params.email || "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) {
      Alert.alert("Missing Fields", "Please enter both email and the 6-digit code.");
      return;
    }

    setLoading(true);
    try {
      await verifyEmail(email.trim(), code.trim());
      Alert.alert(
        "Verification Successful",
        "Your email has been verified. You may now sign in.",
        [
          {
            text: "Go to Sign In",
            onPress: () => router.replace("/(auth)/login"),
          },
        ]
      );
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Verification failed";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      Alert.alert("Missing Email", "Please enter your email to resend code.");
      return;
    }

    setResending(true);
    try {
      await resendCode(email.trim());
      Alert.alert("Code Resent", "A new verification code has been dispatched.");
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Failed to resend code";
      Alert.alert("Resend Failed", msg);
    } finally {
      setResending(false);
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
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/login")}
          >
            <ArrowLeft size={22} color={colors.textPrimary} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={36} color={colors.primary} />
            </View>
            <Text style={styles.title}>Verify Email</Text>
            <Text style={styles.subtitle}>
              We sent a verification code to your email address. Enter it below to activate your account.
            </Text>
          </View>

          <Card style={styles.card}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon={<Mail size={20} color={colors.textMuted} />}
            />

            <Input
              label="6-Digit Verification Code"
              placeholder="123456"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />

            <Button
              title="Verify Account"
              onPress={handleVerify}
              loading={loading}
              style={styles.submitBtn}
            />

            <TouchableOpacity
              style={styles.resendRow}
              onPress={handleResend}
              disabled={resending}
            >
              <RefreshCw size={16} color={colors.primary} />
              <Text style={styles.resendText}>
                {resending ? "Sending..." : "Didn't receive code? Resend"}
              </Text>
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  header: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 20,
    paddingHorizontal: 12,
  },
  card: {
    padding: 22,
  },
  submitBtn: {
    marginTop: 18,
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  resendText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
});
