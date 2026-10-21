import { useEffect, useState } from "react";
import {
  QrCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Star,
  Calendar,
  Bell,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Screen } from "./Layout";
import { apiFetch, API_BASE } from "../lib/api";

interface Props {
  setScreen: (s: Screen) => void;
}

interface LoggedUser {
  user_id: number;
  email: string;
  role: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  year_level?: string;
  section?: string;
  profile_photo?: string | null;
}

interface PassportSummary {
  total_activities: number;
  completed_activities: number;
  participation_points: number;
  accomplishment_points: number;
  total_points: number;
}

interface PassportActivity {
  activity_id: number;
  sport_name: string;
  activity_name: string;
  activity_date: string;
  time_in: string | null;
  time_out: string | null;
  participation_status: string | null;
  participation_points: number | null;
  accomplishment_status: string | null;
  accomplishment_points: number | null;
}

interface RankingStudent {
  rank: number;
  student_id: string;
  total_points: string | number;
}

interface FineRecord {
  student_id: string;
  amount: number;
  payment_status: string;
}

interface NotificationItem {
  notification_id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StudentDashboard({ setScreen }: Props) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [activities, setActivities] = useState<PassportActivity[]>([]);
  const [rank, setRank] = useState<number | null>(null);
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (!user?.student_id) return;

    const loadDashboard = async () => {
      try {
        const [passportRes, rankingRes, fineRes, notifRes] = await Promise.all([
          apiFetch(`/api/passport/${user.student_id}`),
          apiFetch("/api/rankings"),
          apiFetch(`/api/fines/student/${user.student_id}`),
          apiFetch(`/api/notifications/${user.student_id}`),
        ]);

        const passportData = await passportRes.json();
        const rankingData: RankingStudent[] = await rankingRes.json();
        const fineData: FineRecord[] = await fineRes.json();
        const notifData: NotificationItem[] = await notifRes.json();

        setSummary(passportData.summary);
        setActivities(passportData.activities || []);

        const currentRank = rankingData.find(
          (r) => r.student_id === user.student_id
        );
        setRank(currentRank?.rank || null);

        setFines(fineData.filter((f) => f.student_id === user.student_id));
        setNotifications(notifData.slice(0, 3));
      } catch {
        alert("Failed to load dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  const fullName =
    user.full_name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    "Student";

  const initials =
    user.first_name && user.last_name
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : "ST";

  const photoUrl = user.profile_photo
    ? `${API_BASE}/uploads/${user.profile_photo}`
    : null;

  const totalFine = fines
    .filter((f) => f.payment_status !== "paid")
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const attendanceComplete = activities.filter((a) => a.time_in && a.time_out).length;
  const attendanceRate =
    activities.length > 0
      ? Math.round((attendanceComplete / activities.length) * 100)
      : 0;

  const weeklyPoints = activities.map((a) => ({
    day: formatDate(a.activity_date),
    pts: Number(a.participation_points || 0) + Number(a.accomplishment_points || 0),
  }));

  const recentActivities = activities.slice(0, 4);

  return (
    <div className="space-y-5">
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #0F2450 0%, #2563EB 100%)",
        }}
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-40 opacity-10"
          style={{ background: "radial-gradient(circle, #F59E0B, transparent)" }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
            style={{ background: "#F59E0B" }}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="flex-1">
            <p className="text-white/55 text-xs">Welcome back,</p>
            <h1 className="font-heading font-bold text-xl text-white">{fullName}</h1>
            <p className="text-white/60 text-sm">
              {user.year_level || "Year Level"} · Section {user.section || "N/A"} ·{" "}
              {user.student_id}
            </p>
          </div>

          <div className="flex gap-5">
            <div className="text-center">
              <p className="text-2xl font-heading font-bold text-white">
                {summary?.total_points || 0}
              </p>
              <p className="text-white/50 text-xs">Points</p>
            </div>

            <div className="w-px bg-white/15" />

            <div className="text-center">
              <p
                className="text-2xl font-heading font-bold"
                style={{ color: "#F59E0B" }}
              >
                {rank ? `#${rank}` : "N/A"}
              </p>
              <p className="text-white/50 text-xs">Rank</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-4">
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-white/50">Passport Progress</span>
            <span className="text-white font-semibold">
              {summary?.completed_activities || 0}/{summary?.total_activities || 0} activities
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/20">
            <div
              className="h-full rounded-full"
              style={{
                width: `${
                  summary && summary.total_activities > 0
                    ? (summary.completed_activities / summary.total_activities) * 100
                    : 0
                }%`,
                background: "#F59E0B",
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Activities Joined",
            value: summary?.completed_activities || 0,
            icon: "🎯",
            color: "#2563EB",
          },
          {
            label: "Points Earned",
            value: summary?.total_points || 0,
            icon: "⭐",
            color: "#F59E0B",
          },
          {
            label: "Attendance Rate",
            value: `${attendanceRate}%`,
            icon: "📋",
            color: "#10B981",
          },
          {
            label: "Outstanding Fines",
            value: `₱${totalFine}`,
            icon: "💰",
            color: "#EF4444",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="text-2xl mb-2">{s.icon}</div>
            <p className="text-xl font-heading font-bold" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {totalFine > 0 && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all"
          style={{ background: "#FEF2F2", border: "1px solid #EF444430" }}
          onClick={() => setScreen("my-fines")}
        >
          <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: "#DC2626" }}>
              You have ₱{totalFine} in unpaid fines
            </p>
            <p className="text-xs text-red-700">
              Missing time-in or time-out scans were detected.
            </p>
          </div>
          <span className="text-xs font-bold" style={{ color: "#DC2626" }}>
            View →
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className="lg:col-span-2 rounded-2xl p-5 border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="font-heading font-bold text-foreground mb-1">
            Points Progress
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            Points earned from scanned activities
          </p>

          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={weeklyPoints}>
              <defs>
                <linearGradient id="ptsG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="pts"
                stroke="#F59E0B"
                strokeWidth={2.5}
                fill="url(#ptsG)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-2xl p-5 border cursor-pointer hover:shadow-md transition-all flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, #0F2450, #2563EB)",
            borderColor: "transparent",
          }}
          onClick={() => setScreen("qr-code")}
        >
          <div>
            <QrCode size={36} className="text-white mb-3" />
            <h3 className="font-heading font-bold text-white text-lg">My QR Code</h3>
            <p className="text-white/60 text-sm mt-1">
              Show this for attendance time-in and time-out
            </p>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-white/60 text-xs">Active</span>
            </div>
            <span className="text-white/70 text-sm font-bold">Open →</span>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-foreground">Recent Attendance</h3>
            <p className="text-xs text-muted-foreground">Latest scanned activity records</p>
          </div>
          <button
            onClick={() => setScreen("attendance-history")}
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            Full History →
          </button>
        </div>

        <div className="space-y-3">
          {recentActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No attendance records yet.
            </p>
          ) : (
            recentActivities.map((e) => {
              const complete = e.time_in && e.time_out;
              const noOut = e.time_in && !e.time_out;

              return (
               <div
                  key={e.activity_id}
                  className="flex items-center gap-4 p-3 rounded-xl"
                  style={{ background: "var(--muted)" }}
                >
                  <div className="flex-1 min-w-0">

                    <h3 className="text-m text-muted-foreground flex items-center gap-1 mt-1">
                      📅 {formatDate(e.activity_date)}
                    </h3>
                  </div>

                  <div className="flex gap-3 text-xs">
                    <span
                      className="flex items-center gap-1"
                      style={{ color: e.time_in ? "#10B981" : "#EF4444" }}
                    >
                      {e.time_in ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {formatTime(e.time_in) ?? "No In"}
                    </span>

                    <span
                      className="flex items-center gap-1"
                      style={{
                        color: e.time_out ? "#10B981" : e.time_in ? "#EF4444" : "#9CA3AF",
                      }}
                    >
                      {e.time_out ? <CheckCircle size={12} /> : e.time_in ? <XCircle size={12} /> : null}
                      {formatTime(e.time_out) ?? (e.time_in ? "No Out" : "—")}
                    </span>
                  </div>

                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                    style={{
                      background: complete ? "#10B98120" : noOut ? "#F59E0B20" : "#EF444420",
                      color: complete ? "#10B981" : noOut ? "#F59E0B" : "#EF4444",
                    }}
                  >
                    {complete ? "Complete" : noOut ? "No Out" : "Incomplete"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-heading font-bold text-foreground">Latest Notifications</h3>
            <p className="text-xs text-muted-foreground">Recent announcements and reminders</p>
          </div>
          <button
            onClick={() => setScreen("notifications")}
            className="text-xs font-semibold hover:underline"
            style={{ color: "var(--primary)" }}
          >
            View All →
          </button>
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.notification_id}
                className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: "var(--muted)" }}
              >
                <Bell size={15} style={{ color: "var(--primary)" }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground">{n.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Sportfest Passport", icon: "📖", screen: "passport" as Screen },
          { label: "Rankings", icon: "🏆", screen: "rankings" as Screen },
          { label: "Activities", icon: "📋", screen: "activities" as Screen },
          { label: "My Fines", icon: "💰", screen: "my-fines" as Screen },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => setScreen(a.screen)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:shadow-sm transition-all"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div className="text-2xl">{a.icon}</div>
            <span className="text-xs font-semibold text-muted-foreground">
              {a.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}