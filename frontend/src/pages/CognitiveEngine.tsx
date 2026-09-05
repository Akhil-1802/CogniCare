import { motion } from "framer-motion";
import {
  MessageSquare,
  Brain,
  Tags,
  Database,
  Search,
  Sparkles,
  Bell,
  ArrowDown,
  Cpu,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { engineSteps } from "@/data/mockData";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Brain,
  Tags,
  Database,
  Search,
  Sparkles,
  Bell,
};

export default function CognitiveEngine() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 pb-20 lg:pb-8"
    >
      <div className="text-center max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-4 py-1.5 text-sm font-medium text-sky-700 mb-4">
          <Cpu className="h-4 w-4" />
          Core Architecture
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Cognitive Memory Engine
        </h1>
        <p className="mt-3 text-slate-500">
          The chatbot is the interaction layer. The Cognitive Memory Engine is
          the core — it extracts, classifies, stores, and retrieves memories
          semantically.
        </p>
      </div>

      {/* Workflow Diagram */}
      <div className="max-w-xl mx-auto space-y-0">
        {engineSteps.map((step, index) => {
          const Icon = iconMap[step.icon] || Brain;
          const isLast = index === engineSteps.length - 1;

          return (
            <div key={step.id}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden transition-shadow hover:shadow-md">
                  <CardContent className="flex items-start gap-4 p-5">
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 shadow-sm">
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-sky-200 text-[10px] font-bold text-sky-600">
                        {step.id}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{step.title}</h3>
                        {index === 0 && <Badge variant="secondary">Input</Badge>}
                        {index === 3 && <Badge variant="default">Storage</Badge>}
                        {isLast && <Badge variant="warning">Output</Badge>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {!isLast && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.1 + 0.05 }}
                  className="flex justify-center py-2"
                >
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-px bg-sky-200" />
                    <ArrowDown className="h-4 w-4 text-sky-400 -mt-0.5" />
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-3 max-w-4xl mx-auto">
        {[
          {
            title: "Vector Database",
            description:
              "Memories are converted to embeddings and stored for semantic similarity search.",
            icon: Database,
          },
          {
            title: "NLP Extraction",
            description:
              "Natural language processing identifies objects, locations, reminders, and intents.",
            icon: Brain,
          },
          {
            title: "Caregiver Bridge",
            description:
              "When confidence falls below threshold, the system notifies the connected caregiver.",
            icon: Bell,
          },
        ].map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.1 }}
          >
            <Card className="h-full bg-sky-50/50 border-sky-100">
              <CardContent className="p-5">
                <card.icon className="h-6 w-6 text-sky-600 mb-3" />
                <h3 className="font-semibold text-slate-900">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{card.description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-6 sm:p-8 text-center">
          <Sparkles className="h-8 w-8 text-sky-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold">End-to-End Workflow</h3>
          <p className="mt-2 text-slate-300 text-sm max-w-lg mx-auto">
            Patient chats with AI → Important information extracted → Stored in
            Vector Database → Appears in Memory Timeline → Retrieved when needed
            → If confidence is low, caregiver is notified → Caregiver responds
            → Memory updated
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
