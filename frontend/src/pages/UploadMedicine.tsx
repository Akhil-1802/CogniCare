import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Pill,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Image,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MedicineExtraction } from "@/types";

type UploadType = "prescription" | "medicine" | "report";

const uploadTypes = [
  {
    id: "prescription" as UploadType,
    title: "Prescription",
    description: "Upload doctor's prescription",
    icon: FileText,
    accept: ".pdf,.jpg,.png",
  },
  {
    id: "medicine" as UploadType,
    title: "Medicine Image",
    description: "Photo of medicine packaging",
    icon: Pill,
    accept: ".jpg,.png,.webp",
  },
  {
    id: "report" as UploadType,
    title: "Medical Report",
    description: "Lab results or medical documents",
    icon: ClipboardList,
    accept: ".pdf,.jpg,.png",
  },
];

const mockExtraction: MedicineExtraction = {
  medicine: "Metformin",
  dosage: "1 Tablet",
  timing: "After Breakfast",
  frequency: "Daily",
};

export default function UploadMedicine() {
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting" | "done" | "saved">("idle");
  const [extraction, setExtraction] = useState<MedicineExtraction | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (type: UploadType) => {
    setSelectedType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPhase("uploading");

    setTimeout(() => {
      setPhase("extracting");
      setTimeout(() => {
        setExtraction(mockExtraction);
        setPhase("done");
      }, 2000);
    }, 1500);

    e.target.value = "";
  };

  const handleSave = () => {
    setPhase("saved");
  };

  const reset = () => {
    setSelectedType(null);
    setFileName(null);
    setPhase("idle");
    setExtraction(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Medicine</h1>
        <p className="mt-1 text-slate-500">
          Upload prescriptions and medical documents for AI extraction
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={uploadTypes.find((t) => t.id === selectedType)?.accept}
        onChange={handleFileChange}
      />

      {/* Upload Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        {uploadTypes.map((type) => (
          <motion.div
            key={type.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedType === type.id && phase !== "idle"
                  ? "ring-2 ring-sky-500 border-sky-200"
                  : ""
              }`}
              onClick={() => handleFileSelect(type.id)}
            >
              <CardContent className="flex flex-col items-center p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 mb-4">
                  <type.icon className="h-7 w-7 text-sky-600" />
                </div>
                <h3 className="font-semibold text-slate-900">{type.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{type.description}</p>
                <Button variant="secondary" size="sm" className="mt-4 gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Choose File
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Processing & Results */}
      <AnimatePresence mode="wait">
        {phase !== "idle" && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="bg-sky-50/50">
                <CardTitle className="flex items-center gap-2 text-base">
                  {phase === "uploading" && (
                    <>
                      <Loader2 className="h-5 w-5 text-sky-600 animate-spin" />
                      Uploading...
                    </>
                  )}
                  {phase === "extracting" && (
                    <>
                      <Loader2 className="h-5 w-5 text-sky-600 animate-spin" />
                      AI Extracting Information...
                    </>
                  )}
                  {(phase === "done" || phase === "saved") && (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      Medicine Detected
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {fileName && (
                  <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-50">
                    <Image className="h-5 w-5 text-slate-400" />
                    <span className="text-sm text-slate-600 truncate">{fileName}</span>
                    <Badge variant="secondary" className="ml-auto shrink-0">
                      {selectedType}
                    </Badge>
                  </div>
                )}

                {(phase === "uploading" || phase === "extracting") && (
                  <div className="space-y-3">
                    <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-sky-500 rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: phase === "uploading" ? "40%" : "85%" }}
                        transition={{ duration: 1.5 }}
                      />
                    </div>
                    <p className="text-sm text-slate-500 text-center">
                      {phase === "uploading"
                        ? "Uploading document securely..."
                        : "Analyzing prescription with AI..."}
                    </p>
                  </div>
                )}

                {extraction && (phase === "done" || phase === "saved") && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="space-y-4"
                  >
                    <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                          <Pill className="h-5 w-5 text-sky-600" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Medicine Detected</p>
                          <p className="text-xl font-bold text-slate-900">
                            {extraction.medicine}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { label: "Dosage", value: extraction.dosage },
                          { label: "Timing", value: extraction.timing },
                          { label: "Frequency", value: extraction.frequency },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg bg-white p-3 border border-sky-50">
                            <p className="text-xs text-slate-500">{label}</p>
                            <p className="font-semibold text-slate-800 mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {phase === "saved" ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 p-4 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Saved to Memory Successfully</span>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <Button onClick={handleSave} className="flex-1 gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Save to Memory
                        </Button>
                        <Button variant="outline" onClick={reset}>
                          Upload Another
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
