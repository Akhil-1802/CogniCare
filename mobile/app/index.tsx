import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { colors } from "../src/theme/colors";

export default function IndexScreen() {
  const { user, role, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!user || !role) {
      router.replace("/(auth)/login");
    } else if (role === "Patient") {
      router.replace("/(patient)");
    } else if (role === "CareTaker") {
      router.replace("/(caregiver)");
    }
  }, [user, role, isLoading]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.text}>Opening CogniCare...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
