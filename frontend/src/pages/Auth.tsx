import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import axios from "axios";

import {
  HeartPulse,
  Mail,
  Lock,
  Phone,
  User,
  ArrowRight,
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
    role: "Patient" | "CareTaker";
  }

interface LoginForm {
  email: string;
  password: string;
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate()
    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors, isSubmitting },
      } = useForm<RegisterForm & LoginForm>({
        defaultValues: {
          role: "Patient",
        },
      });
  const onLogin = async (data: LoginForm) => {
    try {
      const response = await axios.post("http://localhost:8000/auth/login", data);
        const role = response.data.role
        if(role == "CareTaker"){
            navigate("/caregiverdashboard")
        }
        else if(role == "Patient"){
            navigate("/patientdashboard")
        }
    } catch (err) {
      console.log(err);
    }
  };

  const onRegister = async (data: RegisterForm) => {
    try {
      await axios.post("http://localhost:8000/auth/register", data);
        setIsLogin(true)
      console.log(data);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100 flex items-center justify-center px-6">
      <div className="grid lg:grid-cols-2 max-w-6xl w-full gap-10 items-center">
        {/* Left Side */}

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-sky-500 flex items-center justify-center">
              <HeartPulse className="text-white h-7 w-7" />
            </div>

            <div>
              <h1 className="text-4xl font-bold text-slate-900">
                CogniCare
              </h1>

              <p className="text-slate-500">
                AI Cognitive Memory Assistant
              </p>
            </div>
          </div>

          <h2 className="text-5xl font-bold text-slate-900 leading-tight">
            Helping Patients
            <span className="text-sky-600"> Remember Better.</span>
          </h2>

          <p className="mt-6 text-lg text-slate-600 max-w-lg">
            Securely manage memories, medicine reminders and connect with
            caregivers through AI-powered cognitive assistance.
          </p>
        </motion.div>

        {/* Right */}

        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="shadow-2xl border-0 rounded-3xl">
            <CardContent className="p-10">
              <div className="flex bg-slate-100 rounded-xl p-1 mb-8">
                <button
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition ${
                    isLogin
                      ? "bg-white shadow text-sky-600"
                      : "text-slate-500"
                  }`}
                >
                  Login
                </button>

                <button
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition ${
                    !isLogin
                      ? "bg-white shadow text-sky-600"
                      : "text-slate-500"
                  }`}
                >
                  Register
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isLogin ? (
                  <motion.form
                    key="login"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    onSubmit={handleSubmit(onLogin)}
                    className="space-y-5"
                  >
                    <div>
                      <label>Email</label>

                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          className="pl-10"
                          {...register("email", {
                            required: true,
                          })}
                        />
                      </div>
                    </div>

                    <div>
                      <label>Password</label>

                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          type="password"
                          className="pl-10"
                          {...register("password", {
                            required: true,
                          })}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 bg-sky-600 hover:bg-sky-700"
                      disabled={isSubmitting}
                    >
                      Login

                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="register"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    onSubmit={handleSubmit(onRegister)}
                    className="space-y-5"
                  >
                    <div>
                      <label>Name</label>

                      <div className="relative mt-2">
                        <User className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          className="pl-10"
                          {...register("name", {
                            required: true,
                          })}
                        />
                      </div>
                    </div>

                    <div>
                      <label>Email</label>

                      <div className="relative mt-2">
                        <Mail className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          className="pl-10"
                          {...register("email", {
                            required: true,
                          })}
                        />
                      </div>
                    </div>

                    <div>
                      <label>Phone</label>

                      <div className="relative mt-2">
                        <Phone className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          className="pl-10"
                          {...register("phone", {
                            required: true,
                          })}
                        />
                      </div>
                    </div>
                    <div>
  <label className="block mb-2">Role</label>

  <select
    className="w-full h-11 rounded-md border border-slate-300 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500"
    {...register("role", {
      required: true,
    })}
  >
    <option value="Patient">Patient</option>
    <option value="CareTaker">CareTaker</option>
  </select>
</div>
                    <div>
                      <label>Password</label>

                      <div className="relative mt-2">
                        <Lock className="absolute left-3 top-3 text-slate-400 h-5" />

                        <Input
                          type="password"
                          className="pl-10"
                          {...register("password", {
                            required: true,
                            minLength: 6,
                          })}
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 bg-sky-600 hover:bg-sky-700"
                      disabled={isSubmitting}
                    >
                      Create Account

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