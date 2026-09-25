import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, ChevronRight, Search, Brain, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import api from "@/lib/api";

interface LiveMemory {
  id: string;
  title: string;
  content: string;
  memory_type?: string;
  importance?: string;
  confidence?: number;
  total_score?: number;
  created_at?: string;
  dateGroup?: string;
}

function getMemoryIcon(type?: string): string {
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

function getDateGroup(isoStr?: string): "Today" | "Yesterday" | "Earlier" {
  if (!isoStr) return "Today";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return "Today";
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return "Earlier";
  } catch {
    return "Today";
  }
}

function formatMemoryDate(isoStr?: string): string {
  if (!isoStr) return "Recently recorded";
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoStr.slice(0, 10);
  }
}

function formatConfidence(conf?: number): string {
  if (conf === undefined || conf === null) return "95%";
  const val = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
  return `${val}%`;
}

const groups = ["Today", "Yesterday", "Earlier"] as const;

export default function MemoryTimeline() {
  const [memories, setMemories] = useState<LiveMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api
      .get("/api/v1/memories")
      .then((res) => {
        if (Array.isArray(res.data)) {
          setMemories(res.data);
        } else {
          setMemories([]);
        }
      })
      .catch(() => {
        setMemories([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const filtered = memories.filter(
    (m) =>
      (m.title || "").toLowerCase().includes(search.toLowerCase()) ||
      (m.content || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Memory Timeline</h1>
        <p className="mt-1 text-slate-500">
          All memories stored in your cognitive memory engine
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search memories semantically..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {loading ? (
        <Card className="border-slate-200">
          <CardContent className="p-8 text-center text-slate-500">
            Loading your stored memories...
          </CardContent>
        </Card>
      ) : memories.length === 0 ? (
        <Card className="border-dashed border-slate-200 bg-white">
          <CardContent className="p-8 text-center space-y-3">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Brain className="h-6 w-6" />
            </div>
            <p className="font-semibold text-slate-900">No memories recorded yet</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              Conversations with your AI assistant will automatically be scored and stored here.
            </p>
            <div className="pt-2">
              <Link to="/assistant">
                <Button size="sm" className="bg-sky-600 hover:bg-sky-700 gap-1.5">
                  <MessageSquare className="h-4 w-4" />
                  Ask AI Assistant
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {groups.map((group) => {
            const groupMemories = filtered.filter((m) => getDateGroup(m.created_at) === group);
            if (groupMemories.length === 0) return null;

            return (
              <div key={group}>
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-sky-600" />
                  <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    {group}
                  </h2>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <div className="space-y-3">
                  {groupMemories.map((memory, index) => (
                    <motion.div
                      key={memory.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link to={`/memory/${memory.id}`}>
                        <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-sky-100 border-slate-200 bg-white">
                          <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-2xl">
                              {getMemoryIcon(memory.memory_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-slate-900 group-hover:text-sky-700 transition-colors truncate">
                                {memory.title}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-500 truncate">
                                {memory.content}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {formatMemoryDate(memory.created_at)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-semibold">
                                {formatConfidence(memory.confidence)}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-sky-500 transition-colors" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && memories.length > 0 && (
            <div className="text-center py-12 text-slate-500">
              <p>No memories found matching &ldquo;{search}&rdquo;.</p>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}
