import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, ChevronRight, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { memories } from "@/data/mockData";
import { useState } from "react";

const groups = ["Today", "Yesterday"] as const;

export default function MemoryTimeline() {
  const [search, setSearch] = useState("");

  const filtered = memories.filter(
    (m) =>
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
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
          All memories stored in the cognitive memory engine
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

      {groups.map((group) => {
        const groupMemories = filtered.filter((m) => m.dateGroup === group);
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
                  transition={{ delay: index * 0.06 }}
                >
                  <Link to={`/memory/${memory.id}`}>
                    <Card className="group cursor-pointer transition-all hover:shadow-md hover:border-sky-100">
                      <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-2xl">
                          {memory.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 group-hover:text-sky-700 transition-colors">
                            {memory.title}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500 truncate">
                            {memory.description}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">{memory.date}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary">{memory.confidence}%</Badge>
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

      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No memories found matching your search.</p>
        </div>
      )}
    </motion.div>
  );
}
