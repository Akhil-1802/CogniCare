import React from "react";
import { Tabs } from "expo-router";
import {
  Users,
  LayoutDashboard,
  Activity,
  Bell,
  FileUp,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";

export default function CaregiverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: "My Patients",
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: "AI Activity",
          tabBarIcon: ({ color, size }) => (
            <Activity size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ color, size }) => (
            <Bell size={size} color={color} />
          ),
        }}
      />

      {/* Hidden sub-screens */}
      <Tabs.Screen
        name="upload"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
