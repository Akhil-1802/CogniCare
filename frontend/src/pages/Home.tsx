import { motion } from "framer-motion";
import {
  Brain,
  HeartPulse,
  Bell,
  FileText,
  Users,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "Cognitive Memory Engine",
    icon: Brain,
    description:
      "Stores meaningful memories extracted from conversations and documents.",
  },
  {
    title: "Medicine Reminders",
    icon: Bell,
    description:
      "Never miss medications with intelligent reminder scheduling.",
  },
  {
    title: "CareTaker Dashboard",
    icon: Users,
    description:
      "CareTakers can validate memories and monitor patient progress.",
  },
  {
    title: "Medical Documents",
    icon: FileText,
    description:
      "Securely upload prescriptions, reports and healthcare records.",
  },
];
export default function Home() {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-blue-100">
        {/* Navbar */}
  
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-xl sm:rounded-2xl bg-sky-500 p-2 sm:p-3">
              <HeartPulse className="h-5 w-5 sm:h-7 sm:w-7 text-white" />
            </div>
  
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
                CogniCare
              </h1>
  
              <p className="text-xs sm:text-sm text-slate-500 hidden sm:block">
                AI Cognitive Memory Assistant
              </p>
            </div>
          </div>
  
          <div className="flex gap-2 sm:gap-3">
            <Link to="/auth">
              <Button variant="outline" size="sm" className="sm:h-10 sm:px-4 sm:text-sm">
                Login
              </Button>
            </Link>
  
            <Link to="/auth">
              <Button size="sm" className="bg-sky-600 hover:bg-sky-700 sm:h-10 sm:px-4 sm:text-sm">
                Register
              </Button>
            </Link>
          </div>
        </nav>
  
        {/* Hero */}
  
        <section className="mx-auto flex max-w-7xl flex-col items-center gap-10 px-4 py-10 sm:px-6 md:flex-row md:justify-between md:py-20">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            className="max-w-xl text-center md:text-left"
          >
            <span className="inline-block rounded-full bg-sky-100 px-3 py-1.5 text-xs sm:text-sm font-medium text-sky-700">
              AI Powered Healthcare
            </span>
  
            <h1 className="mt-6 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-slate-900">
              Helping Patients
              <span className="text-sky-600">
                {" "}
                Remember Better.
              </span>
            </h1>
  
            <p className="mt-5 sm:mt-8 text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">
              CogniCare is an AI-powered cognitive memory assistant designed
              for people with Mild Cognitive Impairment and early-stage
              Alzheimer's disease. It remembers conversations, medicine,
              appointments, and important information while enabling
              CareTakers to validate memories.
            </p>
  
            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center md:justify-start">
              <Link to="/auth">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700"
                >
                  Get Started
  
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
  
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Learn More
              </Button>
            </div>
          </motion.div>
  
          <motion.div
            initial={{ opacity: 0, scale: .9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm md:max-w-none md:w-auto"
          >
            <div className="rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-10 shadow-2xl">
              <Brain className="mx-auto h-28 w-28 sm:h-40 sm:w-40 lg:h-52 lg:w-52 text-sky-500" />
  
              <div className="mt-4 sm:mt-6 text-center">
                <h2 className="text-xl sm:text-2xl font-bold">
                  Cognitive Memory Engine
                </h2>
  
                <p className="mt-2 text-sm sm:text-base text-slate-500">
                  AI extracts, stores and retrieves important memories.
                </p>
              </div>
            </div>
          </motion.div>
        </section><section className="mx-auto max-w-7xl px-6 py-20">

<h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold">
Core Features
</h2>

<div className="mt-8 sm:mt-14 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">

{features.map((feature)=>(
<Card key={feature.title} className="transition hover:-translate-y-1 hover:shadow-xl">

<CardContent className="p-8">

<feature.icon className="h-12 w-12 text-sky-500"/>

<h3 className="mt-6 text-xl font-semibold">
{feature.title}
</h3>

<p className="mt-3 text-slate-500">
{feature.description}
</p>

</CardContent>

</Card>
))}

</div>

</section><section className="bg-white py-12 sm:py-20">

<h2 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold px-4">
How CogniCare Works
</h2>

<div className="mx-auto mt-10 sm:mt-16 grid max-w-6xl grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8 text-center px-4 sm:px-6">

<div>
<h3 className="text-lg sm:text-xl font-semibold">1</h3>
<p className="mt-2 sm:mt-3 text-sm sm:text-base">Upload conversations, reports or medicines.</p>
</div>

<div>
<h3 className="text-lg sm:text-xl font-semibold">2</h3>
<p className="mt-2 sm:mt-3 text-sm sm:text-base">AI extracts meaningful memories.</p>
</div>

<div>
<h3 className="text-lg sm:text-xl font-semibold">3</h3>
<p className="mt-2 sm:mt-3 text-sm sm:text-base">Memories are stored securely.</p>
</div>

<div>
<h3 className="text-lg sm:text-xl font-semibold">4</h3>
<p className="mt-2 sm:mt-3 text-sm sm:text-base">Retrieve memories anytime through AI.</p>
</div>

</div>

</section><section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-20 text-center">

<ShieldCheck className="mx-auto h-12 w-12 sm:h-16 sm:w-16 text-sky-500"/>

<h2 className="mt-4 sm:mt-6 text-2xl sm:text-3xl md:text-4xl font-bold">
Built for Alzheimer's & Mild Cognitive Impairment
</h2>

<p className="mx-auto mt-5 sm:mt-8 max-w-3xl text-base sm:text-lg leading-7 sm:leading-8 text-slate-600">

CogniCare combines Large Language Models, semantic memory retrieval,
careTaker validation and multimodal understanding to provide a secure,
personalized cognitive assistant that helps patients retain important
information while keeping CareTakers actively involved.

</p>

<Link to="/auth">

<Button
size="lg"
className="mt-8 sm:mt-10 w-full sm:w-auto bg-sky-600 hover:bg-sky-700"
>

Create Free Account

</Button>

</Link>

</section>
</div>
)
}