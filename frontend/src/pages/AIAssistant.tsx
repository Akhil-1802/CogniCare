import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MemoryExtractedCard } from "@/components/MemoryExtractedCard";
import { suggestedQuestions } from "@/data/mockData";
import type { ChatMessage, MemoryExtraction } from "@/types";

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "user",
    content: "I kept my wallet in the blue drawer.",
    timestamp: "9:10 AM",
  },
  {
    id: "2",
    role: "assistant",
    content: "I've remembered that your wallet is stored in the blue drawer.",
    timestamp: "9:10 AM",
    memoryExtracted: {
      object: "Wallet",
      location: "Blue Drawer",
      category: "Object Location",
      status: "Stored Successfully",
    },
  },
  {
    id: "3",
    role: "user",
    content: "Remind me to take medicine after breakfast.",
    timestamp: "9:12 AM",
  },
  {
    id: "4",
    role: "assistant",
    content: "I've saved this reminder.",
    timestamp: "9:12 AM",
    memoryExtracted: {
      medicine: "Medicine",
      timing: "After Breakfast",
      frequency: "Daily",
      category: "Medicine Reminder",
      status: "Stored Successfully",
    },
  },
];

function getSimulatedResponse(input: string): {
  content: string;
  extraction?: MemoryExtraction;
} {
  const lower = input.toLowerCase();

  if (lower.includes("wallet") || lower.includes("blue drawer")) {
    return {
      content: "I've remembered that your wallet is stored in the blue drawer.",
      extraction: {
        object: "Wallet",
        location: "Blue Drawer",
        category: "Object Location",
        status: "Stored Successfully",
      },
    };
  }
  if (lower.includes("medicine") || lower.includes("breakfast")) {
    return {
      content: "I've saved this reminder.",
      extraction: {
        medicine: "Medicine",
        timing: "After Breakfast",
        frequency: "Daily",
        category: "Medicine Reminder",
        status: "Stored Successfully",
      },
    };
  }
  if (lower.includes("glasses")) {
    return {
      content:
        "I'm searching my memory... I couldn't find where your glasses are. My confidence is low on this. Would you like me to notify your caregiver?",
    };
  }
  if (lower.includes("appointment") || lower.includes("doctor")) {
    return {
      content: "Your doctor appointment with Dr. Patel is on Friday at 10:00 AM.",
      extraction: {
        category: "Appointment",
        status: "Retrieved Successfully",
      },
    };
  }

  return {
    content:
      "I understand. I'll remember that for you. Is there anything else you'd like me to help with?",
    extraction: {
      category: "Object Location",
      status: "Stored Successfully",
    },
  };
}

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const response = getSimulatedResponse(text);
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.content,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        memoryExtracted: response.extraction,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col pb-20 lg:pb-0 lg:h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600">
            <Bot className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">AI Assistant</h1>
            <p className="text-sm text-slate-500">Cognitive Memory Interface</p>
          </div>
        </div>
        <Badge variant="success" className="gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Online
        </Badge>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[var(--shadow-card)]">
        <div className="flex h-full flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        msg.role === "user"
                          ? "bg-sky-100"
                          : "bg-gradient-to-br from-sky-500 to-blue-600"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User className="h-4 w-4 text-sky-600" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div
                      className={`max-w-[80%] ${msg.role === "user" ? "text-right" : ""}`}
                    >
                      <div
                        className={`inline-block rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-sky-600 text-white rounded-tr-sm"
                            : "bg-slate-50 text-slate-800 rounded-tl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400 px-1">
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>

                  {msg.memoryExtracted && (
                    <MemoryExtractedCard extraction={msg.memoryExtracted} />
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="flex items-center gap-1 rounded-2xl bg-slate-50 px-4 py-3 rounded-tl-sm">
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-bounce [animation-delay:300ms]" />
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions */}
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
              <span className="text-xs font-medium text-slate-500">Suggested</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 rounded-xl"
                title="Voice input (UI only)"
              >
                <Mic className="h-4 w-4 text-sky-600" />
              </Button>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Type a message..."
                className="min-h-[44px] max-h-32 flex-1"
                rows={1}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isTyping}
                size="icon"
                className="shrink-0 rounded-xl"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
