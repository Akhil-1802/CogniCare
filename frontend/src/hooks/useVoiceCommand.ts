import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export type VoiceMode = "navigation" | "chat";

const NAV_COMMANDS: { patterns: string[]; path: string; label: string }[] = [
  { patterns: ["dashboard", "home", "go home"], path: "/patientdashboard", label: "Dashboard" },
  { patterns: ["routine", "daily routine", "schedule", "my schedule"], path: "/routine", label: "Daily Routine" },
  { patterns: ["assistant", "ai assistant", "chat", "talk to ai"], path: "/assistant", label: "AI Assistant" },
  { patterns: ["upload", "upload medicine", "prescription", "scan medicine"], path: "/upload", label: "Upload Medicine" },
  { patterns: ["timeline", "memory timeline", "memories"], path: "/timeline", label: "Memory Timeline" },
  { patterns: ["notification", "notifications", "alerts"], path: "/notifications", label: "Notifications" },
  { patterns: ["caregiver", "caretaker", "my caretaker"], path: "/caregiver", label: "CareTaker" },
  { patterns: ["engine", "memory engine", "cognitive"], path: "/engine", label: "Memory Engine" },
];

function detectNavigation(transcript: string): { path: string; label: string } | null {
  const t = transcript.toLowerCase().trim();
  const hasIntent = ["go to", "open", "show", "navigate", "take me to", "create", "add", "set", "reminder"].some(
    (k) => t.includes(k)
  );
  if (!hasIntent && !NAV_COMMANDS.some((c) => c.patterns.some((p) => t === p))) return null;
  for (const cmd of NAV_COMMANDS) {
    if (cmd.patterns.some((p) => t.includes(p))) return { path: cmd.path, label: cmd.label };
  }
  if (t.includes("reminder") || t.includes("appointment")) return { path: "/routine", label: "Daily Routine" };
  return null;
}

export function useVoiceCommand(
  mode: VoiceMode = "navigation",
  onTranscript?: (text: string) => void,
  onInterim?: (text: string) => void
) {
  const [listening, setListening] = useState(false);
  const [navFeedback, setNavFeedback] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef("");
  const navigate = useNavigate();

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);

  const stop = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setListening(false);
    finalTranscriptRef.current = "";
    onInterim?.("");
  }, [onInterim]);

  const start = useCallback(() => {
    if (!supported || listening) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: typeof SpeechRecognition = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;        // keep mic open
    rec.interimResults = true;    // show words as they're spoken
    rec.maxAlternatives = 3;      // pick best alternative

    finalTranscriptRef.current = "";

    rec.onstart = () => setListening(true);

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = "";
      let final = finalTranscriptRef.current;

      for (let i = e.resultIndex; i < e.results.length; i++) {
        // Pick the highest-confidence alternative
        let best = e.results[i][0];
        for (let j = 1; j < e.results[i].length; j++) {
          if (e.results[i][j].confidence > best.confidence) best = e.results[i][j];
        }
        if (e.results[i].isFinal) {
          final += best.transcript;
        } else {
          interim += best.transcript;
        }
      }

      finalTranscriptRef.current = final;

      // Show live interim text in the input box
      if (mode === "chat") {
        onInterim?.(final + interim);
      }

      // Reset silence timer — auto-submit after 1.8s of silence
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (mode === "chat" && final.trim()) {
        silenceTimerRef.current = setTimeout(() => {
          const text = finalTranscriptRef.current.trim();
          rec.stop();
          if (text) onTranscript?.(text);
          onInterim?.("");
          finalTranscriptRef.current = "";
        }, 1800);
      }
    };

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      // "no-speech" is normal — just restart silently
      if (e.error === "no-speech") {
        rec.stop();
        return;
      }
      setListening(false);
      onInterim?.("");
    };

    rec.onend = () => {
      setListening(false);
      onInterim?.("");

      // navigation mode: process whatever was captured
      if (mode === "navigation") {
        const text = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = "";
        if (!text) return;
        const nav = detectNavigation(text);
        if (nav) {
          setNavFeedback(`Opening ${nav.label}…`);
          setTimeout(() => { navigate(nav.path); setNavFeedback(null); }, 800);
        } else {
          navigate("/assistant", { state: { voiceMessage: text } });
        }
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [supported, listening, mode, navigate, onTranscript, onInterim]);

  return { listening, navFeedback, supported, start, stop };
}
