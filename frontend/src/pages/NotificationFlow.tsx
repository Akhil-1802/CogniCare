import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Search,
  AlertTriangle,
  User,
  Bot,
  CheckCircle2,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { careTaker } from "@/data/mockData";

type FlowStep =
  | "idle"
  | "question"
  | "searching"
  | "not-found"
  | "notifying"
  | "waiting"
  | "responded"
  | "updated";

export default function NotificationFlow() {
  const [step, setStep] = useState<FlowStep>("idle");

  const startDemo = () => {
    setStep("question");
    setTimeout(() => setStep("searching"), 1500);
    setTimeout(() => setStep("not-found"), 3500);
    setTimeout(() => setStep("notifying"), 5000);
    setTimeout(() => setStep("waiting"), 6500);
    setTimeout(() => setStep("responded"), 9000);
    setTimeout(() => setStep("updated"), 11000);
  };

  const reset = () => setStep("idle");

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Flow</h1>
          <p className="mt-1 text-slate-500">
            See how CogniCare handles low-confidence memory retrieval
          </p>
        </div>
        {step === "idle" ? (
          <Button onClick={startDemo} className="gap-2">
            <Bell className="h-4 w-4" />
            Start Demo
          </Button>
        ) : (
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>

      {step === "idle" && (
        <Card className="border-dashed border-2 border-sky-200 bg-sky-50/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 mb-4">
              <Bell className="h-8 w-8 text-sky-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              CareTaker Notification Demo
            </h3>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Click &quot;Start Demo&quot; to simulate a scenario where the patient
              asks about their glasses, no memory is found, and the connected
              CareTaker is notified.
            </p>
          </CardContent>
        </Card>
      )}

      <AnimatePresence mode="wait">
        {step !== "idle" && (
          <motion.div
            key="flow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {/* Step 1: Patient Question */}
            {["question", "searching", "not-found", "notifying", "waiting", "responded", "updated"].includes(step) && (
              <FlowStepCard delay={0}>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                    <User className="h-4 w-4 text-sky-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">Patient asks</p>
                    <p className="rounded-2xl bg-sky-600 text-white px-4 py-2 text-sm inline-block rounded-tr-sm">
                      &quot;Where are my glasses?&quot;
                    </p>
                  </div>
                </div>
              </FlowStepCard>
            )}

            {/* Step 2: Searching */}
            {["searching", "not-found", "notifying", "waiting", "responded", "updated"].includes(step) && (
              <FlowStepCard delay={0.1}>
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-slate-500 mb-1">AI Assistant</p>
                    {step === "searching" ? (
                      <div className="flex items-center gap-2 text-sm text-sky-600">
                        <Search className="h-4 w-4 animate-pulse" />
                        Searching Memory...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-700">No memory found.</p>
                        <Badge variant="warning" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Confidence Low
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </FlowStepCard>
            )}

            <Connector visible={["notifying", "waiting", "responded", "updated"].includes(step)} />

            {/* Step 3: Notification Sent */}
            {["notifying", "waiting", "responded", "updated"].includes(step) && (
              <FlowStepCard delay={0.2} highlight>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                    <Bell className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">
                      Notification Sent to CareTaker
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">CareTaker</span>
                        <span className="font-medium">{careTaker.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Reason</span>
                        <span className="font-medium">Memory not found</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status</span>
                        <Badge variant={step === "waiting" ? "warning" : "success"}>
                          {step === "waiting" ? "Waiting for Response" : "Responded"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </FlowStepCard>
            )}

            <Connector visible={["responded", "updated"].includes(step)} />

            {/* Step 4: CareTaker Response */}
            {["responded", "updated"].includes(step) && (
              <FlowStepCard delay={0.3}>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                    <User className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">
                      CareTaker replied
                    </p>
                    <p className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-2.5 text-sm text-slate-800">
                      &quot;Your glasses are on the bedside table.&quot;
                    </p>
                  </div>
                </div>
              </FlowStepCard>
            )}

            <Connector visible={step === "updated"} />

            {/* Step 5: Memory Updated */}
            {step === "updated" && (
              <FlowStepCard delay={0.4} success>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  <div>
                    <p className="font-semibold text-emerald-800">
                      Memory Updated Successfully
                    </p>
                    <p className="text-sm text-emerald-600 mt-0.5">
                      Glasses → Bedside Table stored in Vector Database
                    </p>
                  </div>
                </div>
              </FlowStepCard>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function FlowStepCard({
  children,
  delay = 0,
  highlight = false,
  success = false,
}: {
  children: React.ReactNode;
  delay?: number;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 24 }}
    >
      <Card
        className={
          highlight
            ? "border-amber-200 bg-gradient-to-br from-amber-50 to-white shadow-[var(--shadow-elevated)]"
            : success
              ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
              : ""
        }
      >
        <CardContent className="p-5">{children}</CardContent>
      </Card>
    </motion.div>
  );
}

function Connector({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      className="flex justify-center py-1"
    >
      <ArrowDown className="h-5 w-5 text-sky-300" />
    </motion.div>
  );
}
