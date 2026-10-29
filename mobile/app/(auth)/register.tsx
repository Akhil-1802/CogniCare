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
import { useRouter } from "expo-router";
import { User, Mail, Lock, Phone, ArrowLeft } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/ui/Button";
import { Input } from "../../src/components/ui/Input";
import { Card } from "../../src/components/ui/Card";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      Alert.alert("Missing Fields", "Please complete all fields to sign up.");
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
      });

      Alert.alert(
        "Account Created",
        "A 6-digit verification code has been sent to your email.",
        [
          {
            text: "Verify Now",
            onPress: () => {
              router.push({
                pathname: "/(auth)/verify",
                params: { email: email.trim() },
              });
            },
          },
        ]
      );
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || "Registration failed";
      Alert.alert("Registration Error", msg);
    } finally {
      setLoading(false);
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
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color={colors.textPrimary} />
            <Text style={styles.backText}>Back to Sign In</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Create Caregiver Account</Text>
            <Text style={styles.subtitle}>
              Manage care routines, review AI memory extractions, and support your patients.
            </Text>
          </View>

          <Card style={styles.card}>
            <Input
              label="Full Name"
              placeholder="Dr. Sarah Johnson"
              value={name}
              onChangeText={setName}
              icon={<User size={20} color={colors.textMuted} />}
            />

            <Input
              label="Email Address"
              placeholder="sarah@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              icon={<Mail size={20} color={colors.textMuted} />}
            />

            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon={<Phone size={20} color={colors.textMuted} />}
            />

            <Input
              label="Password"
              placeholder="Minimum 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon={<Lock size={20} color={colors.textMuted} />}
            />

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.submitBtn}
            />
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
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 6,
    lineHeight: 20,
  },
  card: {
    padding: 22,
  },
  submitBtn: {
    marginTop: 20,
  },
});
