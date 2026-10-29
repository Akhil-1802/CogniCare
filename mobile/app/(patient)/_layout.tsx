import React from "react";
import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  CalendarCheck,
  BotMessageSquare,
  Brain,
  HeartHandshake,
} from "lucide-react-native";
import { colors } from "../../src/theme/colors";

export default function PatientLayout() {
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
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="routine"
        options={{
          title: "Routine",
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: "Assistant",
          tabBarIcon: ({ color, size }) => (
            <BotMessageSquare size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memories"
        options={{
          title: "Memories",
          tabBarIcon: ({ color, size }) => (
            <Brain size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="caregiver"
        options={{
          title: "Caregiver",
          tabBarIcon: ({ color, size }) => (
            <HeartHandshake size={size} color={color} />
          ),
        }}
      />

      {/* Hidden sub-screens accessible via in-app navigation */}
      <Tabs.Screen
        name="upload"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
