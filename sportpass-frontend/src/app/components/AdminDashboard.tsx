import { useEffect, useState } from "react";
import {
  Users,
  Calendar,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Activity,
  Trophy,
  Star,
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
import type { Screen } from "./Layout";
import { apiFetch } from "../lib/api";

interface Props {
  setScreen: (s: Screen) => void;
}

interface DashboardData {
  summary: {
    total_students: number;
    total_activities: number;
    total_attendance: number;
    participation_points: number;
    accomplishment_points: number;
    total_points: number;
    outstanding_fines: number;
  };

  topStudents: {
    student_id: string;
    student_name: string;
    year_level: string;
    section: string;
    total_points: string | number;
  }[];

  recentActivities: {
    activity_id: number;
    sport_name: string;
    activity_name: string;
    activity_date: string;
    activity_time: string;
    activity_location: string;
    status: string;
    participation_points: number;
    accomplishment_points: number;
  }[];

  yearLevelPoints: {
    year_level: string;
    total_points: string | number;
  }[];
}

const colors = [
  "#2563EB",
  "#F59E0B",
  "#10B981",
  "#8B5CF6",
  "#EF4444",
];

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 border relative overflow-hidden"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-6 translate-x-6 opacity-10"
        style={{ background: color }}
      />

      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{
          background: color + "18",
          color,
        }}
      >
        {icon}
      </div>

      <p className="text-2xl font-heading font-bold text-foreground">
        {value}
      </p>

      <p className="text-xs font-semibold text-foreground mt-0.5">
        {label}
      </p>

      <p className="text-xs text-muted-foreground mt-0.5">
        {sub}
      </p>
    </div>
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AdminDashboard({ setScreen }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      const response = await apiFetch(
        "/api/admin/dashboard"
      );

      const result = await response.json();

      setData(result);
    } catch {
      alert("Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading admin dashboard...
      </div>
    );
  }

  const summary = data.summary;

  /*
   * BACKEND RETURNS:
   * yearLevelPoints
   * year_level
   * total_points
   */
  const yearChartData = (data.yearLevelPoints ?? []).map((y) => ({
  name: y.year_level || "Unknown",
  points: Number(y.total_points || 0),
}));

  return (
    <div className="space-y-6">

      {/* HERO */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, #0F2450 0%, #2563EB 100%)",
        }}
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-40 opacity-10"
          style={{
            background:
              "radial-gradient(circle, #F59E0B, transparent)",
          }}
        />

        <div className="relative z-10">
          <p className="text-white/60 text-sm mb-1">
            SPORTPASS · Administrator Panel
          </p>

          <h1 className="font-heading font-bold text-2xl text-white">
            Welcome back, Admin! 👋
          </h1>

          <p className="text-white/65 text-sm mt-1.5">
            <span className="text-white font-semibold">
              {summary.total_students} students
            </span>{" "}
            enrolled ·{" "}
            <span style={{ color: "#F59E0B" }}>
              {summary.total_activities} activities
            </span>{" "}
            created
          </p>

          <div className="flex gap-3 mt-4 flex-wrap">
            <button
              onClick={() => setScreen("attendance")}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/25 text-white/85 hover:bg-white/15 transition-all"
            >
              Manage Attendance
            </button>

            <button
              onClick={() => setScreen("fines")}
              className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: "#F59E0B",
                color: "#1E293B",
              }}
            >
              Fine Monitoring
            </button>

            <button
              onClick={() => setScreen("reports")}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-white/25 text-white/85 hover:bg-white/15 transition-all"
            >
              Reports
            </button>
          </div>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users size={18} />}
          label="Total Students"
          value={summary.total_students}
          sub="Registered students"
          color="#2563EB"
        />

        <StatCard
          icon={<Calendar size={18} />}
          label="Activities"
          value={summary.total_activities}
          sub="Sportfest activities"
          color="#10B981"
        />

        <StatCard
          icon={<TrendingUp size={18} />}
          label="Total Points"
          value={summary.total_points}
          sub={`${summary.participation_points} participation + ${summary.accomplishment_points} accomplishment`}
          color="#F59E0B"
        />

        <StatCard
          icon={<DollarSign size={18} />}
          label="Outstanding Fines"
          value={`₱${summary.outstanding_fines}`}
          sub="Unpaid scan penalties"
          color="#EF4444"
        />
      </div>

      {/* YEAR LEVEL CHART + POINT BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <div
          className="lg:col-span-2 rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading font-bold text-foreground">
                Year Level Points
              </h3>

              <p className="text-xs text-muted-foreground">
                Total participation and accomplishment points by year level
              </p>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={yearChartData}
              barSize={42}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />

              <XAxis
                dataKey="name"
                tick={{
                  fontSize: 12,
                  fill: "var(--muted-foreground)",
                }}
                axisLine={false}
                tickLine={false}
              />

              <YAxis
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
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

              <Bar
                dataKey="points"
                radius={[6, 6, 0, 0]}
              >
                {yearChartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={colors[i % colors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <h3 className="font-heading font-bold text-foreground mb-1">
            Point Breakdown
          </h3>

          <p className="text-xs text-muted-foreground mb-4">
            System-wide earned points
          </p>

          <div className="space-y-3">

            <div
              className="rounded-xl p-4"
              style={{ background: "#2563EB15" }}
            >
              <div className="flex items-center gap-2">
                <Star
                  size={15}
                  style={{ color: "#2563EB" }}
                />

                <p className="text-sm font-bold text-foreground">
                  Participation Points
                </p>
              </div>

              <p
                className="text-2xl font-heading font-bold mt-1"
                style={{ color: "#2563EB" }}
              >
                {summary.participation_points}
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: "#F59E0B15" }}
            >
              <div className="flex items-center gap-2">
                <Trophy
                  size={15}
                  style={{ color: "#F59E0B" }}
                />

                <p className="text-sm font-bold text-foreground">
                  Accomplishment Points
                </p>
              </div>

              <p
                className="text-2xl font-heading font-bold mt-1"
                style={{ color: "#F59E0B" }}
              >
                {summary.accomplishment_points}
              </p>
            </div>

            <div
              className="rounded-xl p-4"
              style={{ background: "#10B98115" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle
                  size={15}
                  style={{ color: "#10B981" }}
                />

                <p className="text-sm font-bold text-foreground">
                  Attendance Records
                </p>
              </div>

              <p
                className="text-2xl font-heading font-bold mt-1"
                style={{ color: "#10B981" }}
              >
                {summary.total_attendance}
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* TOP STUDENTS + RECENT ACTIVITIES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* TOP STUDENTS */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground">
              Top Students
            </h3>

            <button
              onClick={() => setScreen("rankings")}
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--primary)" }}
            >
              View Rankings →
            </button>
          </div>

          <div className="space-y-3">

            {(data.topStudents ?? []).map((s, i) => {
              const fullName =
                s.student_name?.trim() || "Unknown Student";

              const nameParts =
                fullName.split(" ");

              const initials =
                nameParts
                  .map((part) => part[0] || "")
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

              return (
                <div
                  key={s.student_id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--muted)" }}
                >

                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background:
                        i === 0
                          ? "#FFD700"
                          : i === 1
                          ? "#C0C0C0"
                          : i === 2
                          ? "#CD7F32"
                          : "#2563EB",
                      color: "#fff",
                    }}
                  >
                    {i + 1}
                  </div>

                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{
                      background:
                        colors[i % colors.length],
                    }}
                  >
                    {initials}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {fullName}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {s.year_level} - {s.section}
                    </p>
                  </div>

                  <div
                    className="font-heading font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    {Number(s.total_points)} pts
                  </div>

                </div>
              );
            })}

          </div>
        </div>

        {/* RECENT ACTIVITIES */}
        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold text-foreground">
              Recent Activities
            </h3>

            <button
              onClick={() => setScreen("activities")}
              className="text-xs font-semibold hover:underline"
              style={{ color: "var(--primary)" }}
            >
              View All →
            </button>
          </div>

          <div className="space-y-3">

            {(data.recentActivities ?? []).map((a) => (
              <div
                key={a.activity_id}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: "var(--muted)" }}
              >

                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "#2563EB20" }}
                >
                  <Activity
                    size={14}
                    style={{ color: "#2563EB" }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {a.sport_name} - {a.activity_name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {formatDate(a.activity_date)} ·{" "}
                    {a.activity_location}
                  </p>
                </div>

                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                  style={{
                    background:
                      a.status === "completed"
                        ? "#10B98120"
                        : a.status === "ongoing"
                        ? "#2563EB20"
                        : "#F59E0B20",

                    color:
                      a.status === "completed"
                        ? "#10B981"
                        : a.status === "ongoing"
                        ? "#2563EB"
                        : "#F59E0B",
                  }}
                >
                  {a.status}
                </span>

              </div>
            ))}

          </div>
        </div>
      </div>

      {/* OUTSTANDING FINES */}
      {summary.outstanding_fines > 0 && (
        <div
          className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-all"
          style={{
            background: "#FEF2F2",
            border: "1px solid #EF444430",
          }}
          onClick={() => setScreen("fines")}
        >
          <AlertTriangle
            size={18}
            style={{
              color: "#EF4444",
              flexShrink: 0,
            }}
          />

          <div className="flex-1">
            <p
              className="text-sm font-bold"
              style={{ color: "#DC2626" }}
            >
              ₱{summary.outstanding_fines} outstanding fines detected
            </p>

            <p className="text-xs text-red-700">
              Some students have missing time-in or time-out scans.
            </p>
          </div>

          <span
            className="text-xs font-bold"
            style={{ color: "#DC2626" }}
          >
            View →
          </span>
        </div>
      )}

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {[
          {
            label: "Students",
            icon: <Users size={17} />,
            screen: "students" as Screen,
            color: "#2563EB",
          },
          {
            label: "Activities",
            icon: <Calendar size={17} />,
            screen: "activities" as Screen,
            color: "#F59E0B",
          },
          {
            label: "Attendance",
            icon: <CheckCircle size={17} />,
            screen: "attendance" as Screen,
            color: "#10B981",
          },
          {
            label: "Reports",
            icon: <TrendingUp size={17} />,
            screen: "reports" as Screen,
            color: "#8B5CF6",
          },
        ].map((a) => (
          <button
            key={a.label}
            onClick={() => setScreen(a.screen)}
            className="flex items-center gap-3 p-4 rounded-xl border hover:shadow-sm transition-all text-left"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: a.color + "18",
                color: a.color,
              }}
            >
              {a.icon}
            </div>

            <span className="text-sm font-semibold text-foreground">
              {a.label}
            </span>
          </button>
        ))}

      </div>
    </div>
  );
}