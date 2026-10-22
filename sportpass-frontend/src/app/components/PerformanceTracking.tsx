import { useEffect, useState } from "react";
import {
  Search,
  TrendingUp,
  Star,
  Award,
  Download,
  Trophy,
  Users,
  Activity,
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
import { apiFetch } from "../lib/api";
import { rewardFor } from "../lib/rewards";
import { downloadCSV, fileStamp } from "../lib/reports";

interface RankingStudent {
  rank: number;
  student_id: string;
  first_name: string;
  last_name: string;
  year_level: string;
  section: string;
  participation_points: string | number;
  accomplishment_points: string | number;
  total_points: string | number;
  activities_joined: number;
}

const colors = ["#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];

function fullName(s: RankingStudent) {
  return `${s.first_name} ${s.last_name}`.trim();
}

function initials(s: RankingStudent) {
  return `${s.first_name?.[0] || ""}${s.last_name?.[0] || ""}`.toUpperCase();
}

function reward(rank: number, points: number) {
  return rewardFor(rank, points);
}

export function PerformanceTracking() {
  const [students, setStudents] = useState<RankingStudent[]>([]);
  const [selected, setSelected] = useState<RankingStudent | null>(null);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("all");
  const [loading, setLoading] = useState(true);

  // Students see only their own performance; admins see everyone.
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isStudent = user.role === "student";

  const fetchPerformance = async () => {
    try {
      const response = await apiFetch("/api/rankings");
      const data = await response.json();
      setStudents(data);

      if (isStudent) {
        const me = data.find(
          (s: RankingStudent) => String(s.student_id) === String(user.student_id)
        );
        if (me) setSelected(me);
      }
    } catch {
      alert("Failed to load performance tracking data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformance();
  }, []);

  const filtered = students.filter((s) => {
    const name = fullName(s).toLowerCase();
    const keyword = search.toLowerCase();

    if (isStudent) return String(s.student_id) === String(user.student_id);

    return (
      (name.includes(keyword) || s.student_id.includes(keyword)) &&
      (filterYear === "all" || s.year_level === filterYear)
    );
  });

  const totalStudents = students.length;
  const totalPoints = students.reduce(
    (sum, s) => sum + Number(s.total_points || 0),
    0
  );
  const avgPoints =
    totalStudents > 0 ? Math.round(totalPoints / totalStudents) : 0;
  const activeStudents = students.filter(
    (s) => Number(s.total_points || 0) > 0
  ).length;

  const yearLevels = [
    "all",
    ...Array.from(new Set(students.map((s) => s.year_level).filter(Boolean))),
  ];

  const yearLevelData = Object.values(
    students.reduce((acc: any, s) => {
      const key = s.year_level || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          name: key,
          points: 0,
          students: 0,
        };
      }

      acc[key].points += Number(s.total_points || 0);
      acc[key].students += 1;

      return acc;
    }, {})
  );

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading performance records...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            {isStudent ? "My Performance" : "Student Performance Tracking"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {isStudent
              ? "Your participation points, accomplishments, ranking and reward eligibility"
              : "Monitor participation points, accomplishment points, rankings, and reward eligibility"}
          </p>
        </div>

        {!isStudent && (
        <button
          onClick={() =>
            downloadCSV(`sportpass-student-performance-${fileStamp()}`, [
              {
                heading: "Student Performance",
                rows: filtered,
                columns: [
                  { label: "Rank", value: (s) => s.rank },
                  { label: "Student ID", value: (s) => s.student_id },
                  { label: "Name", value: (s) => fullName(s) },
                  { label: "Year", value: (s) => s.year_level },
                  { label: "Section", value: (s) => s.section },
                  { label: "Participation Pts", value: (s) => Number(s.participation_points || 0) },
                  { label: "Accomplishment Pts", value: (s) => Number(s.accomplishment_points || 0) },
                  { label: "Total Points", value: (s) => Number(s.total_points || 0) },
                  { label: "Activities Joined", value: (s) => s.activities_joined },
                  { label: "Reward Eligibility", value: (s) => reward(s.rank, Number(s.total_points || 0)) },
                ],
              },
            ])
          }
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:bg-muted"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download size={15} />
          Export
        </button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: totalStudents,
            sub: "Registered students",
            icon: <Users size={18} />,
            color: "#2563EB",
          },
          {
            label: "Active Students",
            value: activeStudents,
            sub: "Students with earned points",
            icon: <Activity size={18} />,
            color: "#10B981",
          },
          {
            label: "Average Points",
            value: avgPoints,
            sub: "Average per student",
            icon: <TrendingUp size={18} />,
            color: "#F59E0B",
          },
          {
            label: "Total Points",
            value: totalPoints,
            sub: "All accumulated points",
            icon: <Star size={18} />,
            color: "#8B5CF6",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2xl p-4 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
              style={{ background: k.color + "18", color: k.color }}
            >
              {k.icon}
            </div>

            <p className="text-2xl font-heading font-bold text-foreground">
              {k.value}
            </p>

            <p className="text-xs font-semibold text-foreground mt-0.5">
              {k.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h3 className="font-heading font-bold text-foreground mb-1">
          Performance by Year Level
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Total points grouped by year level
        </p>

        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={yearLevelData} barSize={42}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
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
              {yearLevelData.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            type="text"
            placeholder="Search by name or student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {yearLevels.map((year) => (
            <button
              key={year}
              onClick={() => setFilterYear(year)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${
                filterYear === year
                  ? "text-white"
                  : "text-muted-foreground border hover:text-foreground"
              }`}
              style={
                filterYear === year
                  ? { background: "var(--primary)" }
                  : { borderColor: "var(--border)" }
              }
            >
              {year === "all" ? "All" : year}
            </button>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl border overflow-x-auto"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div
          className="grid grid-cols-12 gap-2 min-w-[640px] px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
          style={{ background: "var(--muted)" }}
        >
          <div className="col-span-1">Rank</div>
          <div className="col-span-4">Student</div>
          <div className="col-span-2">Year</div>
          <div className="col-span-2 text-center">Points</div>
          <div className="col-span-2 text-center">Activities</div>
          <div className="col-span-1 text-center">View</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No student performance records found.
          </div>
        ) : (
          filtered.map((s, i) => {
            const total = Number(s.total_points || 0);

            return (
              <div
                key={s.student_id}
                className={`grid grid-cols-12 gap-2 min-w-[640px] px-5 py-4 items-center border-t hover:bg-muted/50 transition-colors ${
                  selected?.student_id === s.student_id ? "bg-primary/5" : ""
                }`}
                style={{ borderColor: "var(--border)" }}
              >
                <div className="col-span-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      background:
                        s.rank === 1
                          ? "#FFD700"
                          : s.rank === 2
                          ? "#C0C0C0"
                          : s.rank === 3
                          ? "#CD7F32"
                          : "var(--muted)",
                      color: s.rank <= 3 ? "#fff" : "var(--muted-foreground)",
                    }}
                  >
                    {s.rank <= 3 ? ["🥇", "🥈", "🥉"][s.rank - 1] : s.rank}
                  </div>
                </div>

                <div className="col-span-4 flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: `hsl(${i * 45}, 60%, 50%)` }}
                  >
                    {initials(s)}
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {fullName(s)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.student_id}
                    </p>
                  </div>
                </div>

                <div className="col-span-2">
                  <span
                    className="text-xs px-2 py-1 rounded-lg font-semibold"
                    style={{
                      background: "#2563EB18",
                      color: "var(--primary)",
                    }}
                  >
                    {s.year_level} - {s.section}
                  </span>
                </div>

                <div className="col-span-2 text-center">
                  <span
                    className="font-heading font-bold flex items-center justify-center gap-1"
                    style={{ color: "var(--accent)" }}
                  >
                    <Star size={12} />
                    {total}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    P:{Number(s.participation_points || 0)} · A:
                    {Number(s.accomplishment_points || 0)}
                  </p>
                </div>

                <div className="col-span-2 text-center text-sm font-semibold text-foreground">
                  {s.activities_joined}
                </div>

                <div className="col-span-1 text-center">
                  <button
                    className="text-xs px-2 py-1 rounded-lg font-semibold hover:opacity-80 transition-all"
                    style={{ background: "var(--primary)", color: "white" }}
                    onClick={() => setSelected(s)}
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {selected && (
        <div
          className="fixed inset-y-0 right-0 w-full sm:w-96 z-50 border-l overflow-y-auto p-6"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "-4px 0 40px rgba(0,0,0,0.1)",
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-heading font-bold text-foreground">
              Student Performance
            </h3>
            <button
              onClick={() => setSelected(null)}
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div
            className="rounded-2xl p-5 mb-4"
            style={{
              background: "linear-gradient(135deg, #1E3A6E, #2563EB)",
            }}
          >
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold mb-3"
              style={{ background: "var(--accent)" }}
            >
              {initials(selected)}
            </div>

            <h4 className="font-heading font-bold text-white text-lg">
              {fullName(selected)}
            </h4>
            <p className="text-white/70 text-sm">
              {selected.student_id} · {selected.year_level} - {selected.section}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              {
                label: "Total Points",
                value: Number(selected.total_points || 0),
                icon: "⭐",
              },
              {
                label: "Overall Rank",
                value: `#${selected.rank}`,
                icon: "🏆",
              },
              {
                label: "Participation",
                value: Number(selected.participation_points || 0),
                icon: "🎯",
              },
              {
                label: "Accomplishment",
                value: Number(selected.accomplishment_points || 0),
                icon: "🏅",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-3"
                style={{ background: "var(--muted)" }}
              >
                <p className="text-lg">{s.icon}</p>
                <p className="font-heading font-bold text-foreground text-lg">
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          <div
            className="rounded-xl p-4 mb-4"
            style={{ background: "#F59E0B15" }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Award size={15} style={{ color: "#F59E0B" }} />
              <p className="font-bold text-foreground text-sm">
                Reward Eligibility
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {reward(selected.rank, Number(selected.total_points || 0))}
            </p>
          </div>

          <button
            className="w-full py-2.5 rounded-xl text-white text-sm font-bold"
            style={{ background: "var(--primary)" }}
          >
            Download Performance Report
          </button>
        </div>
      )}
    </div>
  );
}