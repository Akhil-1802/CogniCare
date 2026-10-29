import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Search,
  Brain,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react-native";
import { colors } from "../../../src/theme/colors";
import { Header } from "../../../src/components/ui/Header";
import { Card } from "../../../src/components/ui/Card";
import { Badge } from "../../../src/components/ui/Badge";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import {
  MemoriesApi,
  getDateGroup,
  formatMemoryDate,
  formatConfidence,
} from "../../../src/api/memories";
import type { Memory } from "../../../src/types";

function getMemoryEmoji(type?: string): string {
  switch (type?.toUpperCase()) {
    case "OBJECT_LOCATION":
      return "📍";
    case "MEDICATION":
      return "💊";
    case "APPOINTMENT":
      return "📅";
    case "IMPORTANT_FACT":
      return "🧠";
    case "PREFERENCE":
      return "⭐";
    case "SOCIAL_VISIT":
      return "👥";
    default:
      return "💭";
  }
}

export default function MemoriesTimelineScreen() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMemories = useCallback(async (query?: string) => {
    try {
      if (query && query.trim()) {
        const results = await MemoriesApi.searchMemories(query.trim());
        setMemories(results);
      } else {
        const data = await MemoriesApi.listMemories("ACTIVE");
        setMemories(data);
      }
    } catch {
      setMemories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMemories(searchQuery);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    fetchMemories(text);
  };

  const groups = ["Today", "Yesterday", "Earlier"] as const;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Memory Timeline"
        subtitle="Long-term facts, object locations & routines"
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search: keys, glasses, medicine..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={handleSearch}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {memories.length === 0 ? (
          <EmptyState
            icon={<Brain size={36} color={colors.primary} />}
            title="No Memories Found"
            message={
              searchQuery
                ? `No memories matched "${searchQuery}". Try a different word.`
                : "Ask your AI assistant questions to record locations and preferences automatically."
            }
          />
        ) : (
          groups.map((group) => {
            const groupMemories = memories.filter(
              (m) => getDateGroup(m.created_at) === group
            );

            if (groupMemories.length === 0) return null;

            return (
              <View key={group} style={styles.groupSection}>
                <Text style={styles.groupTitle}>{group}</Text>

                {groupMemories.map((mem) => (
                  <TouchableOpacity
                    key={mem.id}
                    activeOpacity={0.75}
                    onPress={() =>
                      router.push(`/(patient)/memories/${mem.id}` as any)
                    }
                  >
                    <Card style={styles.memoryCard}>
                      <View style={styles.cardRow}>
                        <View style={styles.emojiCircle}>
                          <Text style={styles.emoji}>
                            {getMemoryEmoji(mem.memory_type)}
                          </Text>
                        </View>

                        <View style={styles.textWrap}>
                          <View style={styles.titleRow}>
                            <Text style={styles.memoryTitle}>{mem.title}</Text>
                          </View>

                          <Text style={styles.memorySnippet} numberOfLines={2}>
                            {mem.content || mem.description}
                          </Text>

                          <View style={styles.metaRow}>
                            <Clock size={12} color={colors.textMuted} />
                            <Text style={styles.dateText}>
                              {formatMemoryDate(mem.created_at)}
                            </Text>

                            <Badge
                              label={formatConfidence(mem.confidence || mem.confidence_score)}
                              variant="neutral"
                              style={styles.badge}
                            />

                            {mem.retention_policy ? (
                              <Badge
                                label={mem.retention_policy}
                                variant="secondary"
                                style={styles.badge}
                              />
                            ) : null}
                          </View>
                        </View>

                        <ChevronRight size={20} color={colors.textMuted} />
                      </View>
                    </Card>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.textPrimary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  groupSection: {
    marginBottom: 20,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 8,
    marginLeft: 4,
  },
  memoryCard: {
    padding: 14,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  emoji: {
    fontSize: 22,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  memoryTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  memorySnippet: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    flexWrap: "wrap",
  },
  dateText: {
    fontSize: 11,
    color: colors.textMuted,
    marginLeft: 4,
    marginRight: 8,
  },
  badge: {
    marginRight: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
});
