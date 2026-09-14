import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { useAuth } from "@/contexts/AuthContext";
import {
  HeartPulse,
  Mail,
  Lock,
  Phone,
  User,
  ArrowRight,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface RegisterForm {
  name: string;
  email: string;
  password: string;
  phone: string;
}

interface VerifyForm {
  email: string;
  code: string;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showVerify, setShowVerify] = useState(false);
  const [loginRole, setLoginRole] = useState<"CareTaker" | "Patient">("CareTaker");
  const [pendingEmail, setPendingEmail] = useState("");
  const navigate = useNavigate();
  const { login, register, patientLogin } = useAuth();

  const careTakerLoginForm = useForm<{ email: string; password: string }>();
  const patientLoginForm = useForm<{ patient_id: string; password: string }>();
  const registerForm = useForm<RegisterForm>();
  const verifyForm = useForm<VerifyForm>();

  const onCareTakerLogin = async (data: { email: string; password: string }) => {
    try {
      await login(data.email, data.password);
      navigate("/caregiverdashboard");
    } catch (err: any) {
      const msg = err.response?.data?.detail;
      if (msg === "Please verify your email first") {
        setPendingEmail(data.email);
        setShowVerify(true);
        verifyForm.setValue("email", data.email);
      }
      alert(msg || "Login failed");
    }
  };

  const onPatientLogin = async (data: { patient_id: string; password: string }) => {
    try {
      await patientLogin(data.patient_id, data.password);
      navigate("/patientdashboard");
    } catch (err: any) {
      alert(err.response?.data?.detail || "Login failed");
    }
  };

  const onRegister = async (data: RegisterForm) => {
    try {
      await register(data);
      setPendingEmail(data.email);
      setShowVerify(true);
      verifyForm.setValue("email", data.email);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Registration failed");
    }
  };

  const onVerify = async (data: VerifyForm) => {
    try {
      const res = await fetch("http://localhost:8000/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail);
      }
      alert("Email verified! You can now login.");
      setShowVerify(false);
      setIsLogin(true);
    } catch (err: any) {
      alert(err.message || "Verification failed");
    }
  };

  const onResend = async () => {
    try {
      await fetch("http://localhost:8000/auth/resend-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail }),
      });
      alert("Code resent!");
    } catch {
      alert("Failed to resend code");
    }
  };

  if (showVerify) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-2xl border-0 rounded-3xl max-w-md w-full">
            <CardContent className="p-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center">
                  <ShieldCheck className="text-white h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Verify Email</h2>
                  <p className="text-sm text-slate-500">Check your inbox for the code</p>
                </div>
              </div>

              <form onSubmit={verifyForm.handleSubmit(onVerify)} className="space-y-5">
                <div>
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <Input className="mt-2" {...verifyForm.register("email", { required: true })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Verification Code</label>
                  <Input
                    className="mt-2 tracking-widest text-center text-lg"
                    placeholder="000000"
                    {...verifyForm.register("code", { required: true })}
                  />
                </div>
                <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700">
                  Verify
                </Button>
                <button
                  type="button"
                  onClick={onResend}
                  className="w-full text-sm text-sky-600 hover:underline"
                >
                  Resend Code
                </button>
                <button
                  type="button"
                  onClick={() => { setShowVerify(false); setIsLogin(true); }}
                  className="w-full text-sm text-slate-500 hover:underline"
                >
                  Back to Login
                </button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 flex items-center justify-center px-6">
      <div className="grid lg:grid-cols-2 max-w-6xl w-full gap-10 items-center">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-sky-500 flex items-center justify-center">
              <HeartPulse className="text-white h-7 w-7" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-slate-900">CogniCare</h1>
              <p className="text-slate-500">AI Cognitive Memory Assistant</p>
            </div>
          </div>
          <h2 className="text-5xl font-bold text-slate-900 leading-tight">
            Helping Patients
            <span className="text-sky-600"> Remember Better.</span>
          </h2>
          <p className="mt-6 text-lg text-slate-600 max-w-lg">
            Securely manage memories, medicine reminders and connect with
            CareTakers through AI-powered cognitive assistance.
          </p>
        </motion.div>

        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-2xl border-0 rounded-3xl">
            <CardContent className="p-10">
              <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition ${
                    isLogin ? "bg-white shadow text-sky-600" : "text-slate-500"
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition ${
                    !isLogin ? "bg-white shadow text-sky-600" : "text-slate-500"
                  }`}
                >
                  Register
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    className="space-y-5"
                  >
                    {/* Role Selector */}
                    <div className="flex bg-slate-50 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setLoginRole("CareTaker")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition ${
                          loginRole === "CareTaker"
                            ? "bg-white shadow text-sky-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <BadgeCheck className="h-4 w-4" />
                        CareTaker
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoginRole("Patient")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition ${
                          loginRole === "Patient"
                            ? "bg-white shadow text-sky-600"
                            : "text-slate-500 hover:text-slate-700"
                        }`}
                      >
                        <User className="h-4 w-4" />
                        Patient
                      </button>
                    </div>

                    {loginRole === "CareTaker" ? (
                      <form onSubmit={careTakerLoginForm.handleSubmit(onCareTakerLogin)} className="space-y-5">
                        <div>
                          <label className="text-sm font-medium text-slate-700">Email</label>
                          <div className="relative mt-2">
                            <Mail className="absolute left-3 top-3 text-slate-400 h-5" />
                            <Input
                              className="pl-10"
                              placeholder="you@example.com"
                              {...careTakerLoginForm.register("email", { required: true })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700">Password</label>
                          <div className="relative mt-2">
                            <Lock className="absolute left-3 top-3 text-slate-400 h-5" />
                            <Input
                              type="password"
                              className="pl-10"
                              placeholder="Your password"
                              {...careTakerLoginForm.register("password", { required: true })}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700">
                          Login as CareTaker
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={patientLoginForm.handleSubmit(onPatientLogin)} className="space-y-5">
                        <div>
                          <label className="text-sm font-medium text-slate-700">Patient ID</label>
                          <Input
                            className="mt-2"
                            placeholder="PAT-XXXXXX"
                            {...patientLoginForm.register("patient_id", { required: true })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-slate-700">Password</label>
                          <div className="relative mt-2">
                            <Lock className="absolute left-3 top-3 text-slate-400 h-5" />
                            <Input
                              type="password"
                              className="pl-10"
                              placeholder="Your password"
                              {...patientLoginForm.register("password", { required: true })}
                            />
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700">
                          Login as Patient
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </form>
                    )}
                  </motion.div>
                ) : (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    onSubmit={registerForm.handleSubmit(onRegister)}
                    className="space-y-5"
                  >
                    <div>
                      <label className="text-sm font-medium text-slate-700">Name</label>
                      <div className="relative mt-2">
                        <User className="absolute left-3 top-3 text-slate-400 h-5" />
                        <Input className="pl-10" {...registerForm.register("name", { required: true })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-3 text-slate-400 h-5" />
                        <Input className="pl-10" {...registerForm.register("email", { required: true })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Phone</label>
                      <div className="relative mt-2">
                        <Phone className="absolute left-3 top-3 text-slate-400 h-5" />
                        <Input className="pl-10" {...registerForm.register("phone", { required: true })} />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Password</label>
                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-3 text-slate-400 h-5" />
                        <Input
                          type="password"
                          className="pl-10"
                          {...registerForm.register("password", {
                            required: true,
                            minLength: 6,
                          })}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-12 bg-sky-600 hover:bg-sky-700">
                      Create CareTaker Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
