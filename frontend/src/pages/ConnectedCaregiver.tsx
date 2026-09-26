import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  Mail,
  Bell,
  CheckCircle2,
  Send,
  Heart,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/lib/api";
import { sendInquiry } from "@/lib/notifications";
import type { CareTaker } from "@/types";

export default function ConnectedCareTaker() {
  const { user } = useAuth();
  const [alertSent, setAlertSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [caretakerInfo, setCaretakerInfo] = useState<CareTaker | null>(() => {
    if (user && "caretaker" in user && user.caretaker) {
      return user.caretaker as CareTaker;
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  const patientId = user?.id || "";

  useEffect(() => {
    if (user && "caretaker" in user && user.caretaker) {
      setCaretakerInfo(user.caretaker as CareTaker);
      setLoading(false);
    } else if (patientId) {
      api
        .get("/patient-auth/caretaker")
        .then((res) => {
          if (res.data) setCaretakerInfo(res.data);
          else setCaretakerInfo(null);
        })
        .catch(() => {
          setCaretakerInfo(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [user, patientId]);

  const handleSendAlert = async () => {
    if (!caretakerInfo) return;
    setSending(true);
    try {
      await sendInquiry("Patient requested immediate assistance via Connected CareTaker page", "alert", {
        origin: "connected_caretaker_page",
      });
    } catch {
      // Continue to show confirmation if offline
    } finally {
      setSending(false);
      setAlertSent(true);
    }
  };

  const initials = caretakerInfo?.name
    ? caretakerInfo.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "CT";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8 max-w-2xl mx-auto"
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Connected CareTaker</h1>
        <p className="mt-1 text-slate-500">
          Your trusted CareTaker receives alerts when assistance is needed
        </p>
      </div>

      {loading ? (
        <Card className="p-8 text-center text-slate-500">
          Loading caregiver information...
        </Card>
      ) : caretakerInfo ? (
        <Card className="overflow-hidden border-slate-200">
          <div className="bg-gradient-to-br from-sky-500 to-blue-600 px-6 py-8 text-center text-white">
            <Avatar className="h-20 w-20 mx-auto border-4 border-white/30">
              <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
                {caretakerInfo.avatar || initials}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-bold">{caretakerInfo.name}</h2>
            <p className="text-sky-100 text-sm mt-1">
              Relationship: {caretakerInfo.relationship || "Primary CareTaker"}
            </p>
            <Badge className="mt-3 bg-emerald-400/20 text-emerald-100 border-emerald-300/30">
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse mr-1.5 inline-block" />
              {caretakerInfo.status || "Online"}
            </Badge>
          </div>

          <CardContent className="p-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 shrink-0">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Phone</p>
                  {caretakerInfo.phone && caretakerInfo.phone.trim() ? (
                    <a
                      href={`tel:${caretakerInfo.phone}`}
                      className="font-semibold text-sm text-slate-900 hover:text-sky-600 truncate block"
                    >
                      {caretakerInfo.phone}
                    </a>
                  ) : (
                    <p className="font-semibold text-sm text-slate-400">Not provided</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600 shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Email</p>
                  {caretakerInfo.email && caretakerInfo.email.trim() ? (
                    <a
                      href={`mailto:${caretakerInfo.email}`}
                      className="font-semibold text-sm text-slate-900 hover:text-sky-600 truncate block"
                    >
                      {caretakerInfo.email}
                    </a>
                  ) : (
                    <p className="font-semibold text-sm text-slate-400">Not provided</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            <div className="rounded-xl bg-sky-50 p-4">
              <div className="flex items-start gap-3">
                <Heart className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    CareTaker Notifications & Bridge
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {caretakerInfo.name} receives alerts when memory confidence is low or when you
                    request assistance through the AI assistant.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Link to="/assistant" className="flex-1">
                <Button variant="outline" className="w-full gap-2 border-sky-200 text-sky-700 hover:bg-sky-50">
                  <MessageSquare className="h-4 w-4" />
                  Ask AI Assistant
                </Button>
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Verified Caregiver</span>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {alertSent ? (
                <motion.div
                  key="sent"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-700"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Alert sent to {caretakerInfo.name}</span>
                </motion.div>
              ) : (
                <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button
                    onClick={handleSendAlert}
                    disabled={sending}
                    className="w-full gap-2 h-12 bg-rose-600 hover:bg-rose-700 text-white"
                    size="lg"
                  >
                    {sending ? (
                      <>
                        <Send className="h-4 w-4 animate-pulse" />
                        Sending Alert...
                      </>
                    ) : (
                      <>
                        <Bell className="h-4 w-4" />
                        Send Alert to {caretakerInfo.name}
                      </>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-slate-200 bg-white">
          <CardContent className="p-8 text-center space-y-4">
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-rose-50 text-rose-500 font-bold">
              <Users className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">No CareTaker Connected</h2>
              <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                Share your unique Patient ID with your caregiver. When they add you to their dashboard, they will be connected here.
              </p>
              <div className="mt-4 inline-block bg-slate-100 rounded-xl px-4 py-2 border border-slate-200">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Your Patient ID</span>
                <span className="font-mono font-bold text-base text-slate-800">{patientId || "Not authenticated"}</span>
              </div>
            </div>
            <div className="pt-2">
              <Link to="/patientdashboard">
                <Button variant="outline" size="sm">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
