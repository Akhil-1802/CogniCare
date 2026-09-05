import { motion } from "framer-motion";
import { Brain, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { MemoryExtraction } from "@/types";

interface MemoryExtractedCardProps {
  extraction: MemoryExtraction;
}

export function MemoryExtractedCard({ extraction }: MemoryExtractedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="my-3 ml-12 max-w-sm"
    >
      <Card className="border-sky-100 bg-gradient-to-br from-sky-50 to-white overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
              <Brain className="h-4 w-4 text-sky-600" />
            </div>
            <span className="text-sm font-semibold text-sky-800">
              Memory Extracted
            </span>
            <Badge variant="success" className="ml-auto gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {extraction.status}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            {extraction.object && (
              <div className="flex justify-between">
                <span className="text-slate-500">Object</span>
                <span className="font-medium text-slate-800">{extraction.object}</span>
              </div>
            )}
            {extraction.location && (
              <div className="flex justify-between">
                <span className="text-slate-500">Location</span>
                <span className="font-medium text-slate-800">{extraction.location}</span>
              </div>
            )}
            {extraction.medicine && (
              <div className="flex justify-between">
                <span className="text-slate-500">Medicine</span>
                <span className="font-medium text-slate-800">{extraction.medicine}</span>
              </div>
            )}
            {extraction.dosage && (
              <div className="flex justify-between">
                <span className="text-slate-500">Dosage</span>
                <span className="font-medium text-slate-800">{extraction.dosage}</span>
              </div>
            )}
            {extraction.timing && (
              <div className="flex justify-between">
                <span className="text-slate-500">Timing</span>
                <span className="font-medium text-slate-800">{extraction.timing}</span>
              </div>
            )}
            {extraction.frequency && (
              <div className="flex justify-between">
                <span className="text-slate-500">Frequency</span>
                <span className="font-medium text-slate-800">{extraction.frequency}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 border-t border-sky-100">
              <span className="text-slate-500">Category</span>
              <span className="font-medium text-sky-700">{extraction.category}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
