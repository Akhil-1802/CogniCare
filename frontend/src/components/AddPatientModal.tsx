import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { X, UserPlus, Lock, Phone, MapPin, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

interface AddPatientForm {
  name: string;
  phone: string;
  location: string;
  password: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AddPatientModal({ open, onClose }: Props) {
  const { addPatient } = useAuth();
  const [error, setError] = useState("");
  const [patientId, setPatientId] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddPatientForm>();

  const onSubmit = async (data: AddPatientForm) => {
    try {
      setError("");
      const result = await addPatient(data);
      setPatientId(result.patient_id);
      reset();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add patient");
    }
  };

  const handleClose = () => {
    setPatientId("");
    setError("");
    reset();
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <button
              onClick={handleClose}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            {patientId ? (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <UserPlus className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Patient Added!</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Share these credentials with the patient to login.
                </p>

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-500">Patient ID</span>
                      <span className="font-mono font-bold text-sky-600">{patientId}</span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 text-xs text-slate-400">
                  The password you just set is the login password.
                </p>

                <Button onClick={handleClose} className="mt-6 w-full">
                  Done
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                    <UserPlus className="h-5 w-5 text-sky-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Add Patient</h2>
                    <p className="text-sm text-slate-500">Create login credentials</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Name</label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Patient name"
                        {...register("name", { required: "Name is required" })}
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Phone</label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Phone number"
                        {...register("phone", { required: "Phone is required" })}
                      />
                    </div>
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Location</label>
                    <div className="relative mt-1.5">
                      <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="City or address"
                        {...register("location", { required: "Location is required" })}
                      />
                    </div>
                    {errors.location && (
                      <p className="mt-1 text-xs text-red-500">{errors.location.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <div className="relative mt-1.5">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input
                        type="password"
                        className="pl-9"
                        placeholder="Set login password"
                        {...register("password", {
                          required: "Password is required",
                          minLength: { value: 6, message: "Min 6 characters" },
                        })}
                      />
                    </div>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Patient"}
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
