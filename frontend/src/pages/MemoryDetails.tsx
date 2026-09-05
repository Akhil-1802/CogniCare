import { motion } from "framer-motion";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  ArrowLeft,
  Brain,
  Calendar,
  Database,
  Gauge,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { getMemoryById } from "@/data/mockData";

export default function MemoryDetails() {
  const { id } = useParams<{ id: string }>();
  const memory = id ? getMemoryById(id) : undefined;

  if (!memory) {
    return <Navigate to="/timeline" replace />;
  }

  const confidenceColor =
    memory.confidence >= 90
      ? "text-emerald-600"
      : memory.confidence >= 80
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
          {memory.icon}
        </div>
        <div>
          <Badge variant="default" className="mb-2">
            {memory.category}
          </Badge>
          <h1 className="text-2xl font-bold text-slate-900">{memory.title}</h1>
          <p className="mt-2 text-slate-500">{memory.description}</p>
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
              {memory.confidence}%
            </p>
            <Progress value={memory.confidence} className="mt-3" />
            <p className="mt-2 text-xs text-slate-400">
              {memory.confidence >= 90
                ? "High confidence — reliable memory"
                : memory.confidence >= 80
                  ? "Moderate confidence"
                  : "Lower confidence — may need verification"}
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
              <span className="text-slate-500">Date:</span>
              <span className="font-medium">{memory.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Source:</span>
              <span className="font-medium">{memory.source}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4 text-slate-400" />
              <span className="text-slate-500">Stored in:</span>
              <span className="font-medium">Vector Database (Simulated)</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Memory Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(memory.details).map(([key, value]) => (
              <div
                key={key}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {key}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
