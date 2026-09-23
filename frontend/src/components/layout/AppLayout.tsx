import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  MessageSquare,
  Upload,
  Clock,
  Bell,
  Users,
  Brain,
  Menu,
  X,
  LogOut,
  CalendarCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { getNotificationCounts } from "@/lib/notifications";

const navItems = [
  { path: "/patientdashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/routine", label: "Daily Routine", icon: CalendarCheck },
  { path: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { path: "/upload", label: "Upload Medicine", icon: Upload },
  { path: "/timeline", label: "Memory Timeline", icon: Clock },
  { path: "/notifications", label: "Notifications", icon: Bell },
  { path: "/caregiver", label: "CareTaker", icon: Users },
  { path: "/engine", label: "Memory Engine", icon: Brain },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadAnswers, setUnreadAnswers] = useState(0);
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const counts = await getNotificationCounts();
        setUnreadAnswers(counts.unread_answers || 0);
      } catch {
        // Ignored
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 15000);
    return () => clearInterval(interval);
  }, []);

  const NavLink = ({ path, label, icon: Icon }: (typeof navItems)[0]) => {
    const isActive = location.pathname === path;
    const isNotifications = path === "/notifications";

    return (
      <Link
        to={path}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sky-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-sky-50 hover:text-sky-700"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 shrink-0" />
          <span>{label}</span>
        </div>
        {isNotifications && unreadAnswers > 0 && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-bold",
              isActive ? "bg-white text-sky-700" : "bg-emerald-500 text-white animate-pulse"
            )}
          >
            {unreadAnswers}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-100 bg-white lg:block">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 shadow-sm">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">CogniCare</h1>
              <p className="text-xs text-slate-500">AI Memory Assistant</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navItems.map((item) => (
              <NavLink key={item.path} {...item} />
            ))}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                {user && "name" in user ? user.name.charAt(0) : "P"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {user && "name" in user ? user.name : "Patient"}
                </p>
                <p className="text-xs text-slate-500">
                  Patient
                </p>
              </div>
              <button
                onClick={logout}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-slate-900">CogniCare</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <motion.nav
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center gap-3 px-2 pt-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600">
                <Brain className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900">CogniCare</h1>
                <p className="text-xs text-slate-500">AI Memory Assistant</p>
              </div>
            </div>
            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.path} {...item} />
              ))}
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                onClick={() => { logout(); setMobileOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </motion.nav>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-100 bg-white/90 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, 5).map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors",
                  isActive ? "text-sky-600" : "text-slate-400"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "text-sky-600")} />
                <span className="truncate max-w-[56px]">{label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
