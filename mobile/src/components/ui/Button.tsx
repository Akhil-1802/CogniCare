import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { colors } from "../../theme/colors";

interface ButtonProps {
  title: string;
  onPress: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const handlePress = async () => {
    if (disabled || loading) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    onPress();
  };

  const getContainerStyle = () => {
    switch (variant) {
      case "secondary":
        return styles.secondary;
      case "outline":
        return styles.outline;
      case "danger":
        return styles.danger;
      case "ghost":
        return styles.ghost;
      default:
        return styles.primary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case "outline":
      case "ghost":
        return styles.outlineText;
      case "secondary":
        return styles.secondaryText;
      case "danger":
        return styles.dangerText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case "sm":
        return styles.sizeSm;
      case "lg":
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[
        styles.base,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" || variant === "ghost" ? colors.primary : colors.textInverse}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.baseText,
              getTextStyle(),
              icon ? { marginLeft: 8 } : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.secondary,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.borderDark,
    shadowOpacity: 0,
    elevation: 0,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  sizeSm: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sizeMd: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  sizeLg: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 18,
  },
  baseText: {
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  primaryText: {
    color: colors.textInverse,
  },
  secondaryText: {
    color: colors.textInverse,
  },
  outlineText: {
    color: colors.textPrimary,
  },
  dangerText: {
    color: colors.textInverse,
  },
  disabled: {
    opacity: 0.5,
  },
});
