import { useEffect, useState } from "react";
import {
  CheckCircle,
  Trophy,
  Star,
  Award,
  Activity,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { apiFetch, API_BASE } from "../lib/api";
import { ChangePassword } from "./ChangePassword";

interface LoggedUser {
  user_id: number;
  email: string;
  role: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  contact?: string;
  department?: string;
  year_level?: string;
  section?: string;
  profile_photo?: string | null;
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

interface PassportSummary {
  total_activities: number;
  completed_activities: number;
  participation_points: number;
  accomplishment_points: number;
  total_points: number;
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function StudentProfile() {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [activities, setActivities] = useState<PassportActivity[]>([]);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) setUser(JSON.parse(savedUser));
  }, []);

  useEffect(() => {
    if (!user?.student_id) return;

    const loadProfile = async () => {
      try {
        const [passportRes, rankingRes, fineRes] = await Promise.all([
          apiFetch(`/api/passport/${user.student_id}`),
          apiFetch("/api/rankings"),
          apiFetch(`/api/fines/student/${user.student_id}`),
        ]);

        const passportData = await passportRes.json();
        const rankingData: RankingStudent[] = await rankingRes.json();
        const fineData: FineRecord[] = await fineRes.json();

        setActivities(passportData.activities || []);
        setSummary(passportData.summary || null);

        const currentRank = rankingData.find(
          (r) => r.student_id === user.student_id
        );
        setRank(currentRank?.rank || null);

        setFines(fineData.filter((f) => f.student_id === user.student_id));
      } catch {
        alert("Failed to load profile data.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  if (loading || !user) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading profile...
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

  const attendanceComplete = activities.filter((a) => a.time_in && a.time_out).length;

  const attendanceRate =
    activities.length > 0
      ? Math.round((attendanceComplete / activities.length) * 100)
      : 0;

  const outstandingFine = fines
    .filter((f) => f.payment_status !== "paid")
    .reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const chartData = [
    {
      name: "Participation",
      points: summary?.participation_points || 0,
    },
    {
      name: "Accomplishment",
      points: summary?.accomplishment_points || 0,
    },
    {
      name: "Total",
      points: summary?.total_points || 0,
    },
  ];

  const badges = [
    {
      name: "First Step",
      icon: "🎯",
      earned: (summary?.completed_activities || 0) >= 1,
    },
    {
      name: "Rising Star",
      icon: "⭐",
      earned: (summary?.total_points || 0) >= 30,
    },
    {
      name: "Active Player",
      icon: "🏅",
      earned: (summary?.completed_activities || 0) >= 5,
    },
    {
      name: "Top Performer",
      icon: "🏆",
      earned: rank !== null && rank <= 3,
    },
    {
      name: "Clean Record",
      icon: "✅",
      earned: outstandingFine === 0 && activities.length > 0,
    },
    {
      name: "Champion",
      icon: "👑",
      earned: rank === 1,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          Student Profile
        </h2>
        <p className="text-muted-foreground text-sm">
          Personal information and live performance overview
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div
          className="rounded-2xl overflow-hidden border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div
            className="p-6 text-center"
            style={{ background: "linear-gradient(135deg, #1E3A6E, #2563EB)" }}
          >
            <div
              className="w-24 h-24 rounded-full mx-auto flex items-center justify-center text-white text-3xl font-bold mb-3 overflow-hidden"
              style={{ background: "var(--accent)" }}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>

            <h3 className="font-heading font-bold text-white text-xl">
              {fullName}
            </h3>

            <p className="text-white/70 text-sm mt-0.5">
              {user.year_level || "Year Level"} · Section {user.section || "N/A"}
            </p>

            <div className="flex items-center justify-center gap-1 mt-2">
              <Trophy size={14} style={{ color: "var(--accent)" }} />
              <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>
                {rank ? `#${rank} Overall Rank` : "No Rank Yet"}
              </span>
            </div>
          </div>

          <div className="p-5 space-y-3">
            {[
              { label: "Student ID", value: user.student_id || "N/A" },
              { label: "Email", value: user.email || "N/A" },
              { label: "Contact", value: user.contact || "N/A" },
              {
                label: "Department",
                value: user.department || "Computer Studies Department",
              },
              { label: "Year Level", value: user.year_level || "N/A" },
              { label: "Section", value: user.section || "N/A" },
            ].map((f) => (
              <div key={f.label} className="flex justify-between items-center gap-3">
                <span className="text-xs text-muted-foreground">{f.label}</span>
                <span className="text-xs font-semibold text-foreground text-right">
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Total Points",
                value: summary?.total_points || 0,
                icon: "⭐",
                color: "#F59E0B",
              },
              {
                label: "Activities",
                value: summary?.completed_activities || 0,
                icon: "🎯",
                color: "#2563EB",
              },
              {
                label: "Attendance",
                value: `${attendanceRate}%`,
                icon: "📋",
                color: "#10B981",
              },
              {
                label: "Fines",
                value: `₱${outstandingFine}`,
                icon: "💰",
                color: "#EF4444",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl p-4 border text-center"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="text-xl mb-1">{s.icon}</div>
                <p className="text-xl font-heading font-bold" style={{ color: s.color }}>
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-5 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h3 className="font-heading font-bold text-foreground mb-1">
              Performance Points
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Participation and accomplishment point breakdown
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={42}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
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
                <Bar dataKey="points" radius={[6, 6, 0, 0]}>
                  {["#2563EB", "#F59E0B", "#10B981"].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {outstandingFine > 0 && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "#FEF2F2", border: "1px solid #EF444430" }}
        >
          <AlertTriangle size={18} style={{ color: "#EF4444", flexShrink: 0 }} />
          <div className="flex-1">
            <p className="text-sm font-bold" style={{ color: "#DC2626" }}>
              Outstanding Fine: ₱{outstandingFine}
            </p>
            <p className="text-xs text-red-700">
              This is based on missing time-in or time-out records.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-heading font-bold text-foreground">
              Recent Activity Records
            </h3>
          </div>

          <div className="divide-y" style={{ borderColor: "var(--border)" }}>
            {activities.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No activity records yet.
              </div>
            ) : (
              activities.slice(0, 5).map((a) => {
                const points =
                  Number(a.participation_points || 0) +
                  Number(a.accomplishment_points || 0);

                const completed =
                  a.participation_status === "participated" ||
                  a.accomplishment_status === "accomplished";

                return (
                  <div key={a.activity_id} className="flex items-center gap-3 px-5 py-3.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: completed ? "#10B981" : "#F59E0B",
                      }}
                    />

                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {a.sport_name} - {a.activity_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(a.activity_date)}
                      </p>
                    </div>

                    <span className="text-xs font-bold" style={{ color: "#F59E0B" }}>
                      +{points} pts
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          className="rounded-2xl border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h3 className="font-heading font-bold text-foreground">
              Achievements
            </h3>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((b) => (
              <div
                key={b.name}
                className={`rounded-xl p-3 text-center border ${
                  b.earned ? "" : "opacity-40"
                }`}
                style={{
                  borderColor: b.earned ? "var(--accent)" : "var(--border)",
                  background: b.earned ? "#F59E0B12" : "var(--muted)",
                }}
              >
                <div className={`text-2xl mb-1 ${!b.earned ? "grayscale" : ""}`}>
                  {b.icon}
                </div>
                <p className="text-xs font-semibold text-foreground">{b.name}</p>

                {b.earned && (
                  <CheckCircle
                    size={12}
                    className="mx-auto mt-1"
                    style={{ color: "#10B981" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h3 className="font-heading font-bold text-foreground mb-3">
          Performance Summary
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: "#2563EB15" }}>
            <div className="flex items-center gap-2">
              <Star size={15} style={{ color: "#2563EB" }} />
              <p className="text-sm font-bold text-foreground">
                Participation
              </p>
            </div>
            <p className="text-2xl font-heading font-bold mt-1" style={{ color: "#2563EB" }}>
              {summary?.participation_points || 0}
            </p>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#F59E0B15" }}>
            <div className="flex items-center gap-2">
              <Award size={15} style={{ color: "#F59E0B" }} />
              <p className="text-sm font-bold text-foreground">
                Accomplishment
              </p>
            </div>
            <p className="text-2xl font-heading font-bold mt-1" style={{ color: "#F59E0B" }}>
              {summary?.accomplishment_points || 0}
            </p>
          </div>

          <div className="rounded-xl p-4" style={{ background: "#10B98115" }}>
            <div className="flex items-center gap-2">
              <Activity size={15} style={{ color: "#10B981" }} />
              <p className="text-sm font-bold text-foreground">Total</p>
            </div>
            <p className="text-2xl font-heading font-bold mt-1" style={{ color: "#10B981" }}>
              {summary?.total_points || 0}
            </p>
          </div>
        </div>
      </div>

      <ChangePassword />
    </div>
  );
}
