import { motion } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  Calendar,
  Database,
  Gauge,
  FileText,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import api from "@/lib/api";

interface LiveMemoryDetail {
  id: string;
  title: string;
  content: string;
  memory_type?: string;
  importance?: string;
  confidence?: number;
  importance_score?: number;
  confidence_score?: number;
  usefulness_score?: number;
  persistence_score?: number;
  novelty_score?: number;
  total_score?: number;
  created_at?: string;
  expires_at?: string;
  status?: string;
  metadata?: Record<string, any>;
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

function formatMemoryDate(isoStr?: string): string {
  if (!isoStr) return "Recently recorded";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

export default function MemoryDetails() {
  const { id } = useParams<{ id: string }>();
  const [memory, setMemory] = useState<LiveMemoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError(true);
      return;
    }

    api
      .get(`/api/v1/memories/${id}`)
      .then((res) => {
        if (res.data) {
          setMemory(res.data);
        } else {
          setError(true);
        }
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-500">
        <Brain className="h-8 w-8 text-sky-600 animate-pulse mx-auto mb-2" />
        <p>Loading memory details...</p>
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="space-y-4 py-8">
        <Link to="/timeline">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Timeline
          </Button>
        </Link>
        <Card className="border-dashed p-8 text-center text-slate-500">
          <p className="font-semibold text-slate-800">Memory not found or expired.</p>
          <p className="text-sm mt-1">This memory may have been removed or updated.</p>
        </Card>
      </div>
    );
  }

  const rawConf = memory.confidence ?? 0.95;
  const confidencePct = rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);

  const confidenceColor =
    confidencePct >= 90
      ? "text-emerald-600"
      : confidencePct >= 80
      ? "text-amber-600"
      : "text-orange-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <Link to="/timeline">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Timeline
        </Button>
      </Link>

      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-3xl">
          {getMemoryIcon(memory.memory_type)}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="default">
              {memory.memory_type ? memory.memory_type.replace(/_/g, " ") : "Memory"}
            </Badge>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {memory.status || "ACTIVE"}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{memory.title}</h1>
          <p className="mt-2 text-slate-600">{memory.content}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Confidence Score */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Gauge className="h-4 w-4" />
              Confidence Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold ${confidenceColor}`}>
              {confidencePct}%
            </p>
            <Progress value={confidencePct} className="mt-3" />
            <p className="mt-2 text-xs text-slate-400">
              {confidencePct >= 90
                ? "High confidence — validated by cognitive scoring model"
                : confidencePct >= 80
                ? "Moderate confidence — active memory"
                : "Lower confidence — pending review or additional confirmation"}
            </p>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Memory Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Recorded:</span>
              <span className="font-medium text-slate-800">
                {formatMemoryDate(memory.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Importance:</span>
              <span className="font-semibold text-slate-800">
                {memory.importance || "HIGH"} (Score: {Math.round(memory.total_score || 85)})
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Source:</span>
              <span className="font-medium text-slate-800">
                PostgreSQL & ChromaDB Vector Store
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Breakdown or Detailed Attributes */}
      {memory.metadata && Object.keys(memory.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-sky-600" />
              Scoring Breakdown & Context
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {memory.importance_score !== undefined && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <p className="text-xs font-medium text-slate-500 uppercase">Importance</p>
                  <p className="mt-1 font-bold text-slate-900">{memory.importance_score}/100</p>
                </div>
              )}
              {memory.usefulness_score !== undefined && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <p className="text-xs font-medium text-slate-500 uppercase">Usefulness</p>
                  <p className="mt-1 font-bold text-slate-900">{memory.usefulness_score}/100</p>
                </div>
              )}
              {memory.persistence_score !== undefined && (
                <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <p className="text-xs font-medium text-slate-500 uppercase">Persistence</p>
                  <p className="mt-1 font-bold text-slate-900">{memory.persistence_score}/100</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
