import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Brain,
  Shield,
  Clock,
  Sparkles,
  Award,
  CheckCircle,
} from "lucide-react-native";
import { colors } from "../../../src/theme/colors";
import { Header } from "../../../src/components/ui/Header";
import { Card } from "../../../src/components/ui/Card";
import { Badge } from "../../../src/components/ui/Badge";
import { Button } from "../../../src/components/ui/Button";
import { MemoriesApi, formatMemoryDate } from "../../../src/api/memories";
import type { Memory } from "../../../src/types";

export default function MemoryDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [memory, setMemory] = useState<Memory | null>(null);
  const [scoreData, setScoreData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function loadData() {
      try {
        const [mem, sc] = await Promise.all([
          MemoriesApi.getMemoryDetail(id as string),
          MemoriesApi.getMemoryScore(id as string).catch(() => null),
        ]);
        setMemory(mem);
        setScoreData(sc);
      } catch (err) {
        Alert.alert("Error", "Could not load memory details.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Memory Details" showBack />
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!memory) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Memory Details" showBack />
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Memory not found or expired.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreBreakdown =
    scoreData?.score_breakdown ||
    memory.metadata?.score_breakdown || {
      importance: memory.importance_score || 0.8,
      confidence: memory.confidence_score || memory.confidence || 0.9,
      usefulness: memory.usefulness_score || 0.85,
      persistence: memory.persistence_score || 0.7,
      novelty: memory.novelty_score || 0.6,
      total_score: memory.total_score || 78,
    };

  const factors = [
    { label: "Importance", value: scoreBreakdown.importance },
    { label: "Confidence", value: scoreBreakdown.confidence },
    { label: "Usefulness", value: scoreBreakdown.usefulness },
    { label: "Persistence", value: scoreBreakdown.persistence },
    { label: "Novelty", value: scoreBreakdown.novelty },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Memory Insight" showBack />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Main Card */}
        <Card style={styles.mainCard}>
          <View style={styles.titleRow}>
            <View style={styles.badgeRow}>
              <Badge
                label={memory.memory_type || "Memory"}
                variant="primary"
                style={styles.typeBadge}
              />
              <Badge
                label={memory.status || "ACTIVE"}
                variant={memory.status === "ACTIVE" ? "success" : "warning"}
              />
            </View>
            <Text style={styles.title}>{memory.title}</Text>
          </View>

          <Text style={styles.content}>{memory.content || memory.description}</Text>

          <View style={styles.dateMetaRow}>
            <Clock size={14} color={colors.textMuted} />
            <Text style={styles.dateMetaText}>
              Recorded {formatMemoryDate(memory.created_at)}
            </Text>
          </View>
        </Card>

        {/* Cognitive Scoring Engine Breakdown */}
        <Card style={styles.scoreCard}>
          <View style={styles.scoreHeaderRow}>
            <View>
              <Text style={styles.sectionHeading}>Cognitive Evaluation</Text>
              <Text style={styles.sectionSubheading}>
                Multi-dimensional extraction score
              </Text>
            </View>
            <View style={styles.totalScoreCircle}>
              <Text style={styles.totalScoreNum}>
                {Math.round(scoreBreakdown.total_score || 80)}
              </Text>
              <Text style={styles.totalScoreLabel}>PTS</Text>
            </View>
          </View>

          <View style={styles.factorList}>
            {factors.map((f, i) => {
              const val = Math.round((f.value > 1 ? f.value / 100 : f.value) * 100);
              return (
                <View key={i} style={styles.factorItem}>
                  <View style={styles.factorLabelRow}>
                    <Text style={styles.factorName}>{f.label}</Text>
                    <Text style={styles.factorValue}>{val}%</Text>
                  </View>
                  <View style={styles.meterTrack}>
                    <View
                      style={[
                        styles.meterFill,
                        { width: `${val}%` },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Retention Policy Card */}
        <Card style={styles.retentionCard}>
          <View style={styles.retentionRow}>
            <Shield size={24} color={colors.secondary} />
            <View style={styles.retentionTextWrap}>
              <Text style={styles.retentionTitle}>
                Retention Policy: {memory.retention_policy || "STANDARD"}
              </Text>
              <Text style={styles.retentionDescription}>
                Retained for {memory.retention_days || 30} days in persistent active memory unless reconfirmed.
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 40,
  },
  mainCard: {
    padding: 20,
    marginBottom: 16,
  },
  titleRow: {
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  typeBadge: {
    marginRight: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  content: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  dateMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dateMetaText: {
    fontSize: 13,
    color: colors.textMuted,
    marginLeft: 6,
  },
  scoreCard: {
    padding: 20,
    marginBottom: 16,
  },
  scoreHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  sectionSubheading: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  totalScoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  totalScoreNum: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primaryDark,
  },
  totalScoreLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  factorList: {
    marginTop: 4,
  },
  factorItem: {
    marginBottom: 12,
  },
  factorLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  factorName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  factorValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  meterTrack: {
    height: 7,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  retentionCard: {
    padding: 16,
    backgroundColor: colors.secondaryLight,
    borderColor: "#99f6e4",
  },
  retentionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  retentionTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  retentionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.secondary,
  },
  retentionDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
});
