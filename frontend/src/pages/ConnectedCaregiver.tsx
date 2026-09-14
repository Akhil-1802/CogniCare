import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Phone,
  Mail,
  Bell,
  CheckCircle2,
  Send,
  Heart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { careTaker } from "@/data/mockData";

export default function ConnectedCareTaker() {
  const [alertSent, setAlertSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendAlert = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setAlertSent(true);
    }, 1500);
  };

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

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 px-6 py-8 text-center text-white">
          <Avatar className="h-20 w-20 mx-auto border-4 border-white/30">
            <AvatarFallback className="bg-white/20 text-white text-xl font-bold">
              {careTaker.avatar}
            </AvatarFallback>
          </Avatar>
          <h2 className="mt-4 text-xl font-bold">{careTaker.name}</h2>
          <p className="text-sky-100 text-sm mt-1">
            Relationship: {careTaker.relationship}
          </p>
          <Badge className="mt-3 bg-emerald-400/20 text-emerald-100 border-emerald-300/30">
            <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse mr-1.5 inline-block" />
            {careTaker.status}
          </Badge>
        </div>

        <CardContent className="p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <Phone className="h-5 w-5 text-sky-600" />
              <div>
                <p className="text-xs text-slate-500">Phone</p>
                <p className="font-medium text-sm">+1 (555) 234-5678</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
              <Mail className="h-5 w-5 text-sky-600" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="font-medium text-sm">emily.j@email.com</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="rounded-xl bg-sky-50 p-4">
            <div className="flex items-start gap-3">
              <Heart className="h-5 w-5 text-sky-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900 text-sm">
                  CareTaker Notifications
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Emily receives alerts when memory confidence is low or when you
                  request assistance through the AI assistant.
                </p>
              </div>
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
                <span className="font-medium">Alert sent to {careTaker.name}</span>
              </motion.div>
            ) : (
              <motion.div key="button" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Button
                  onClick={handleSendAlert}
                  disabled={sending}
                  className="w-full gap-2 h-12"
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
                      Send Alert
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-600" />
            Recent Alerts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              reason: "Memory not found — glasses location",
              time: "Yesterday, 2:15 PM",
              status: "Responded",
            },
            {
              reason: "Low confidence on appointment time",
              time: "3 days ago",
              status: "Responded",
            },
          ].map((alert) => (
            <div
              key={alert.time}
              className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{alert.reason}</p>
                <p className="text-xs text-slate-400 mt-0.5">{alert.time}</p>
              </div>
              <Badge variant="success">{alert.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
