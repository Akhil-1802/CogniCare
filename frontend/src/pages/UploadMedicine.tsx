import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  FileText,
  Pill,
  ClipboardList,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Clock,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { uploadMedicalDocument, type ExtractedMedication, type DocumentUploadResponse } from "@/lib/documents";

type UploadType = "prescription" | "medicine" | "report";

const uploadTypes = [
  {
    id: "prescription" as UploadType,
    title: "Prescription",
    description: "Doctor's prescription with dosages",
    icon: FileText,
    accept: ".pdf,.jpg,.jpeg,.png",
  },
  {
    id: "medicine" as UploadType,
    title: "Medicine Packaging",
    description: "Photo of medicine box or blister strip",
    icon: Pill,
    accept: ".jpg,.jpeg,.png,.webp",
  },
  {
    id: "report" as UploadType,
    title: "Medical Report",
    description: "Discharge summary or clinical records",
    icon: ClipboardList,
    accept: ".pdf,.jpg,.jpeg,.png",
  },
];

export default function UploadMedicine() {
  const { user, patients } = useAuth();
  const navigate = useNavigate();
  const isCaretaker = user && "email" in user && !("caretaker_id" in user);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    patients && patients.length > 0 ? patients[0].id : ""
  );
  const [selectedType, setSelectedType] = useState<UploadType | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "extracting" | "done" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<DocumentUploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (type: UploadType) => {
    setSelectedType(type);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setPhase("uploading");
    setErrorMessage(null);

    const docTypeMap: Record<UploadType, string> = {
      prescription: "prescription",
      medicine: "medicine_packaging",
      report: "discharge_summary",
    };

    try {
      setPhase("extracting");
      const resp = await uploadMedicalDocument(
        file,
        isCaretaker ? selectedPatientId : undefined,
        undefined,
        selectedType ? docTypeMap[selectedType] : "prescription"
      );
      setResult(resp);
      setPhase("done");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setErrorMessage(msg || "Failed to process OCR and upload document. Please check the file format.");
      setPhase("error");
    } finally {
      e.target.value = "";
    }
  };

  const reset = () => {
    setSelectedType(null);
    setFileName(null);
    setPhase("idle");
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-20 lg:pb-8"
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Upload Medical Records & Medicine</h1>
        <p className="mt-1 text-slate-500">
          Upload prescriptions and medicine documents for real-time OCR extraction & medical memory indexing.
        </p>
      </div>

      {/* Patient selector for Caretakers */}
      {isCaretaker && patients && patients.length > 0 && (
        <Card className="border-sky-100 bg-sky-50/50 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-sky-900 font-medium">
              <User className="h-4 w-4 text-sky-600" />
              <span>Select Patient for this Medical Record:</span>
            </div>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-xs focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={uploadTypes.find((t) => t.id === selectedType)?.accept}
        onChange={handleFileChange}
      />

      {/* Upload Category Cards */}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 mb-4 shadow-xs">
                  <type.icon className="h-7 w-7 text-sky-600" />
                </div>
                <h3 className="font-semibold text-slate-900">{type.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{type.description}</p>
                <Button variant="secondary" size="sm" className="mt-4 gap-1.5 rounded-xl font-medium">
                  <Upload className="h-3.5 w-3.5" />
                  Choose File
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Processing & Results Card */}
      <AnimatePresence mode="wait">
        {phase !== "idle" && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <Card className="overflow-hidden border border-slate-100 shadow-sm">
              <CardHeader className="bg-sky-50/60 border-b border-sky-100/60">
                <CardTitle className="flex items-center gap-2 text-base">
                  {phase === "uploading" && (
                    <>
                      <Loader2 className="h-5 w-5 text-sky-600 animate-spin" />
                      Uploading Document...
                    </>
                  )}
                  {phase === "extracting" && (
                    <>
                      <Loader2 className="h-5 w-5 text-sky-600 animate-spin" />
                      Running High-Speed OCR & Structuring Medications...
                    </>
                  )}
                  {phase === "done" && (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      Medical Record Processed & Saved
                    </>
                  )}
                  {phase === "error" && (
                    <>
                      <AlertCircle className="h-5 w-5 text-rose-500" />
                      Upload Failed
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {fileName && (
                  <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <ImageIcon className="h-5 w-5 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700 truncate">{fileName}</span>
                    <Badge variant="secondary" className="ml-auto shrink-0 uppercase text-[10px]">
                      {selectedType}
                    </Badge>
                  </div>
                )}

                {(phase === "uploading" || phase === "extracting") && (
                  <div className="space-y-3">
                    <div className="h-2 rounded-full bg-sky-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-sky-500 rounded-full"
                        initial={{ width: "10%" }}
                        animate={{ width: phase === "uploading" ? "45%" : "90%" }}
                        transition={{ duration: 1.2 }}
                      />
                    </div>
                    <p className="text-sm text-slate-500 text-center">
                      {phase === "uploading"
                        ? "Uploading file..."
                        : "Performing local ONNX OCR and cross-referencing..."}
                    </p>
                  </div>
                )}

                {phase === "error" && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
                      {errorMessage}
                    </div>
                    <Button onClick={reset} variant="outline">
                      Try Again
                    </Button>
                  </div>
                )}

                {result && phase === "done" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                    {/* Top status bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 text-xs text-emerald-900">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                        <span className="font-semibold">
                          Saved to CogniCare Memory Bank & Vector Index
                        </span>
                      </div>
                      <span className="text-emerald-700 font-medium">
                        OCR Completed in {result.ocr_duration_ms}ms
                      </span>
                    </div>

                    {/* Summary */}
                    {result.document.structured_data.summary && (
                      <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <span className="font-semibold text-slate-800">Document Summary: </span>
                        {result.document.structured_data.summary}
                      </p>
                    )}

                    {/* Medications List */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                        <Pill className="h-4 w-4 text-sky-600" />
                        Detected Medications ({result.medications.length})
                      </h4>

                      {result.medications.length > 0 ? (
                        <div className="space-y-3">
                          {result.medications.map((med: ExtractedMedication, idx: number) => (
                            <div
                              key={idx}
                              className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/50 to-white p-4 shadow-xs"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <span className="text-base font-bold text-slate-900">{med.name}</span>
                                <Badge className="bg-sky-600 text-white text-xs">{med.dosage || "Prescribed dose"}</Badge>
                              </div>

                              <div className="grid gap-2 sm:grid-cols-3 text-xs">
                                <div className="rounded-lg bg-white p-2 border border-slate-100">
                                  <span className="text-slate-400 block">Frequency</span>
                                  <span className="font-medium text-slate-800">{med.frequency || "Daily"}</span>
                                </div>
                                <div className="rounded-lg bg-white p-2 border border-slate-100">
                                  <span className="text-slate-400 block">Timing</span>
                                  <span className="font-medium text-slate-800">{med.timing || "As directed"}</span>
                                </div>
                                <div className="rounded-lg bg-white p-2 border border-slate-100">
                                  <span className="text-slate-400 block">Instructions</span>
                                  <span className="font-medium text-slate-800 truncate block">
                                    {med.instructions || "Take as prescribed"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl">
                          No specific named medications identified in the OCR text. Raw text was indexed into the memory records.
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button
                        onClick={() => navigate("/assistant")}
                        className="flex-1 gap-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-xs"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ask AI Assistant About This Medicine
                      </Button>
                      <Button variant="outline" onClick={reset} className="rounded-xl">
                        Upload Another Document
                      </Button>
                    </div>
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
