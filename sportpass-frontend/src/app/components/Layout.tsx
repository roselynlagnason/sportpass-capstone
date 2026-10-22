import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Calendar, Trophy,
  QrCode, ClipboardList, BookOpen, DollarSign,
  Bell, FileText, Settings, LogOut, Menu, X,
  ChevronRight, Shield, GraduationCap, History, ScanLine, TrendingUp, CalendarDays
} from "lucide-react";
import { API_BASE } from "../lib/api";

export type Screen =
  | "login" | "register"
  | "admin-dashboard" | "student-dashboard"
  | "students" | "activities"
  | "attendance" | "fines" | "rankings" | "reports" | "settings"
  | "qr-code" | "attendance-history" | "passport" | "my-fines"
  | "notifications" | "profile" | "activity-scanner" | "performance" | "sportfest-days";

export type Role = "admin" | "student";

interface NavItem {
  icon: React.ReactNode;
  label: string;
  screen: Screen;
  roles: Role[];
}

interface LoggedUser {
  user_id: number;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_photo?: string | null;
}

const navItems: NavItem[] = [
  { icon: <LayoutDashboard size={18} />, label: "Dashboard", screen: "admin-dashboard", roles: ["admin"] },
  { icon: <Users size={18} />, label: "Student Management", screen: "students", roles: ["admin"] },
  { icon: <Calendar size={18} />, label: "Activity Management", screen: "activities", roles: ["admin"] },
  { icon: <CalendarDays size={18} />, label: "Sportfest Days", screen: "sportfest-days", roles: ["admin"] },
  { icon: <ClipboardList size={18} />, label: "Attendance Monitoring", screen: "attendance", roles: ["admin"] },
  { icon: <DollarSign size={18} />, label: "Fine Monitoring", screen: "fines", roles: ["admin"] },
  { icon: <TrendingUp size={18} />, label: "Performance Tracking", screen: "performance", roles: ["admin"] },
  { icon: <Trophy size={18} />, label: "Rankings & Rewards", screen: "rankings", roles: ["admin"] },
  { icon: <Bell size={18} />, label: "Notifications", screen: "notifications", roles: ["admin"] },
  { icon: <FileText size={18} />, label: "Reports", screen: "reports", roles: ["admin"] },
  { icon: <Settings size={18} />, label: "Settings", screen: "settings", roles: ["admin"] },

  { icon: <LayoutDashboard size={18} />, label: "Dashboard", screen: "student-dashboard", roles: ["student"] },
  { icon: <QrCode size={18} />, label: "My QR Code", screen: "qr-code", roles: ["student"] },
  { icon: <History size={18} />, label: "Attendance History", screen: "attendance-history", roles: ["student"] },
  { icon: <Calendar size={18} />, label: "Activities", screen: "activities", roles: ["student"] },
  { icon: <ScanLine size={18} />, label: "Activity Scanner", screen: "activity-scanner", roles: ["student"] },
  { icon: <BookOpen size={18} />, label: "Sportfest Passport", screen: "passport", roles: ["student"] },
  { icon: <TrendingUp size={18} />, label: "My Performance", screen: "performance", roles: ["student"] },
  { icon: <Trophy size={18} />, label: "Rankings & Rewards", screen: "rankings", roles: ["student"] },
  { icon: <DollarSign size={18} />, label: "My Fines", screen: "my-fines", roles: ["student"] },
  { icon: <Bell size={18} />, label: "Notifications", screen: "notifications", roles: ["student"] },
];

interface LayoutProps {
  currentScreen: Screen;
  setScreen: (s: Screen) => void;
  role: Role;
  onLogout: () => void;
  children: React.ReactNode;
}

export function Layout({ currentScreen, setScreen, role, onLogout, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<LoggedUser | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  const filteredNav = navItems.filter(item => item.roles.includes(role));

  const fullName =
    user?.full_name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    (role === "admin" ? "Administrator" : "Student");

  const initials =
    user?.first_name && user?.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : role === "admin" ? "A" : "S";

  const photoUrl = user?.profile_photo
    ? `${API_BASE}/uploads/${user.profile_photo}`
    : null;

  const handleNav = (screen: Screen) => {
    setScreen(screen);
    setSidebarOpen(false);
  };

  const pageLabel =
    navItems.find(n => n.screen === currentScreen)?.label ??
    (currentScreen === "profile" ? "My Profile" : "Dashboard");

  return (
    <div className="flex h-dvh bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 max-w-[85vw] flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: "linear-gradient(180deg, #0F2450 0%, #1E3A6E 60%, #162D55 100%)" }}
      >
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "var(--accent)" }}>
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <p className="text-white font-heading font-bold text-base leading-none">SPORTPASS</p>
            <p className="text-white/40 text-xs mt-0.5">Sportfest System</p>
          </div>
          <button className="ml-auto lg:hidden text-white/50 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.07)" }}>
            {role === "admin" ? <Shield size={14} style={{ color: "var(--accent)" }} /> : <GraduationCap size={14} style={{ color: "var(--accent)" }} />}
            <span className="text-white/80 text-xs font-semibold">
              {role === "admin" ? "Administrator" : "Student"}
            </span>
            <span className="ml-auto w-2 h-2 rounded-full bg-green-400" />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3">
          {filteredNav.map(item => {
            const isActive = currentScreen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => handleNav(item.screen)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm transition-all group ${isActive ? "text-white font-semibold" : "text-white/55 hover:text-white hover:bg-white/8"}`}
                style={isActive ? { background: "rgba(37,99,235,0.55)" } : {}}
              >
                <span style={isActive ? { color: "var(--accent)" } : {}}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left font-body">{item.label}</span>
                {isActive && <ChevronRight size={13} className="opacity-50" />}
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold flex-shrink-0" style={{ background: "var(--accent)" }}>
              {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{fullName}</p>
              <p className="text-white/40 text-xs truncate">{user?.email || "No email"}</p>
            </div>
          </div>

          <button
            onClick={() => {
              const confirmLogout = window.confirm(
                "Are you sure you want to log out?"
              );

              if (confirmLogout) {
                onLogout();
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/45 hover:text-white hover:bg-white/8 text-sm transition-all"
          >
            <LogOut size={14} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 border-b flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: "var(--border)" }}
        >
          <button className="lg:hidden -ml-1 p-1 text-muted-foreground hover:text-foreground" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-heading font-bold text-foreground text-base truncate">{pageLabel}</h1>
            <p className="text-muted-foreground text-xs truncate">Computer Studies Sportfest</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setScreen("notifications")}
              className="relative p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/8 transition-all"
            >
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: "var(--accent)" }} />
            </button>

            <button
              onClick={() => setScreen(role === "student" ? "profile" : "settings")}
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "var(--primary)" }}
            >
              {photoUrl ? <img src={photoUrl} className="w-full h-full object-cover" /> : initials}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}