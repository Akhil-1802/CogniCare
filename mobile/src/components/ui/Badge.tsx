import React from "react";
import { View, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { colors } from "../../theme/colors";

interface BadgeProps {
  label: string;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "neutral";
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Badge({
  label,
  variant = "primary",
  style,
  textStyle,
}: BadgeProps) {
  const getBackgroundColor = () => {
    switch (variant) {
      case "secondary":
        return colors.secondaryLight;
      case "success":
        return colors.successLight;
      case "warning":
        return colors.warningLight;
      case "danger":
        return colors.dangerLight;
      case "neutral":
        return colors.surfaceMuted;
      default:
        return colors.primaryLight;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "secondary":
        return colors.secondary;
      case "success":
        return colors.success;
      case "warning":
        return colors.warning;
      case "danger":
        return colors.danger;
      case "neutral":
        return colors.textSecondary;
      default:
        return colors.primary;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getBackgroundColor() },
        style,
      ]}
    >
      <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "700",
  },
});
