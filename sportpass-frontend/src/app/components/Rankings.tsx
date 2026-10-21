import { useEffect, useState } from "react";
import {
  Trophy,
  Star,
  Medal,
  Crown,
  Award,
  Download,
  Users,
  TrendingUp,
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
import type { Role } from "./Layout";
import { apiFetch } from "../lib/api";
import { rewardFor } from "../lib/rewards";

type View = "individual" | "year level" | "awards";

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

interface Props {
  role?: Role;
}

const colors = ["#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];

function fullName(s: RankingStudent) {
  return `${s.first_name} ${s.last_name}`.trim();
}

function initials(s: RankingStudent) {
  return `${s.first_name?.[0] || ""}${s.last_name?.[0] || ""}`.toUpperCase();
}

function rewardTitle(rank: number, points: number) {
  return rewardFor(rank, points);
}

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "⭐";
}

export function Rankings({ role }: Props) {
  const [view, setView] = useState<View>("individual");
  const [rankings, setRankings] = useState<RankingStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        const response = await apiFetch("/api/rankings");
        const data = await response.json();
        setRankings(data);
      } catch {
        alert("Failed to load rankings.");
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, []);

  const topThree = rankings.slice(0, 3);
  const highestScore = Number(rankings[0]?.total_points || 0);
  const averageScore =
    rankings.length > 0
      ? Math.round(
          rankings.reduce((sum, s) => sum + Number(s.total_points || 0), 0) /
            rankings.length
        )
      : 0;

  const yearLevelRankings = Object.values(
    rankings.reduce((acc: any, s) => {
      const key = s.year_level || "Unknown";

      if (!acc[key]) {
        acc[key] = {
          name: key,
          pts: 0,
          students: 0,
        };
      }

      acc[key].pts += Number(s.total_points || 0);
      acc[key].students += 1;

      return acc;
    }, {})
  ).sort((a: any, b: any) => b.pts - a.pts);

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading rankings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Rankings & Rewards
          </h2>
          <p className="text-muted-foreground text-sm">
            Automatic rankings based on participation and accomplishment points
          </p>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download size={14} />
          Export
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Participants",
            value: rankings.length,
            icon: <Users size={18} />,
            color: "#2563EB",
          },
          {
            label: "Highest Score",
            value: highestScore,
            icon: <Trophy size={18} />,
            color: "#F59E0B",
          },
          {
            label: "Average Score",
            value: averageScore,
            icon: <TrendingUp size={18} />,
            color: "#10B981",
          },
          {
            label: "Top Performer",
            value: rankings[0] ? fullName(rankings[0]).split(" ")[0] : "N/A",
            icon: <Crown size={18} />,
            color: "#8B5CF6",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
              style={{ background: s.color + "18", color: s.color }}
            >
              {s.icon}
            </div>
            <p
              className="text-2xl font-heading font-bold"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "var(--muted)" }}
      >
        {(["individual", "year level", "awards"] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
              view === v
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "individual" && (
        <>
          <div
            className="rounded-2xl p-6 border"
            style={{
              background: "linear-gradient(135deg, #0F2450, #2563EB)",
              borderColor: "transparent",
            }}
          >
            <h3 className="text-white font-heading font-bold text-center mb-6">
              🏆 Top Performers
            </h3>

            {topThree.length === 0 ? (
              <p className="text-white/60 text-center text-sm">
                No ranking records yet.
              </p>
            ) : (
              <div className="flex items-end justify-center gap-4">
                {topThree[1] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl">🥈</div>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: "#C0C0C0" }}
                    >
                      {initials(topThree[1])}
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">
                        {topThree[1].first_name}
                      </p>
                      <p className="text-white/55 text-xs">
                        {Number(topThree[1].total_points)} pts
                      </p>
                    </div>
                    <div
                      className="w-20 h-14 rounded-t-xl flex items-center justify-center text-white/80 font-bold"
                      style={{ background: "rgba(255,255,255,0.15)" }}
                    >
                      2nd
                    </div>
                  </div>
                )}

                {topThree[0] && (
                  <div className="flex flex-col items-center gap-2 -mb-2">
                    <Crown size={22} style={{ color: "#FFD700" }} />
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-xl border-4 border-yellow-400"
                      style={{ background: "#FFD700" }}
                    >
                      {initials(topThree[0])}
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">
                        {topThree[0].first_name}
                      </p>
                      <p className="text-yellow-300 text-sm font-bold">
                        {Number(topThree[0].total_points)} pts
                      </p>
                    </div>
                    <div
                      className="w-24 h-20 rounded-t-xl flex items-center justify-center text-yellow-200 font-bold"
                      style={{ background: "rgba(255,215,0,0.25)" }}
                    >
                      1st 🥇
                    </div>
                  </div>
                )}

                {topThree[2] && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-3xl">🥉</div>
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ background: "#CD7F32" }}
                    >
                      {initials(topThree[2])}
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">
                        {topThree[2].first_name}
                      </p>
                      <p className="text-white/55 text-xs">
                        {Number(topThree[2].total_points)} pts
                      </p>
                    </div>
                    <div
                      className="w-20 h-10 rounded-t-xl flex items-center justify-center text-white/80 font-bold"
                      style={{ background: "rgba(255,255,255,0.12)" }}
                    >
                      3rd
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="px-5 py-4 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <h3 className="font-heading font-bold text-foreground">
                Overall Leaderboard
              </h3>
            </div>

            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {rankings.map((s, i) => (
                <div
                  key={s.student_id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
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
                    {s.rank}
                  </div>

                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: `hsl(${i * 36}, 60%, 50%)` }}
                  >
                    {initials(s)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                      {fullName(s)} {s.rank <= 3 && <span>{medal(s.rank)}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.student_id} · {s.year_level} - {s.section}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Participation: {Number(s.participation_points)} ·
                      Accomplishment: {Number(s.accomplishment_points)}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-1 font-heading font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    <Star size={13} />
                    {Number(s.total_points)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {view === "year level" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {yearLevelRankings.map((c: any, i: number) => (
              <div
                key={c.name}
                className="rounded-2xl p-5 border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="text-lg font-heading font-bold"
                    style={{ color: colors[i % colors.length] }}
                  >
                    #{i + 1}
                  </span>
                  <Medal size={18} style={{ color: colors[i % colors.length] }} />
                </div>

                <p className="font-heading font-bold text-foreground">
                  {c.name}
                </p>
                <p
                  className="text-2xl font-heading font-bold mt-1"
                  style={{ color: colors[i % colors.length] }}
                >
                  {c.pts}
                </p>
                <p className="text-xs text-muted-foreground">
                  pts · {c.students} students
                </p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-5 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <h3 className="font-heading font-bold text-foreground mb-4">
              Year Level Points Comparison
            </h3>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearLevelRankings} barSize={48}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: "var(--foreground)", fontWeight: 600 }}
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
                <Bar dataKey="pts" radius={[8, 8, 0, 0]}>
                  {yearLevelRankings.map((_: any, i: number) => (
                    <Cell key={i} fill={colors[i % colors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {view === "awards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rankings.slice(0, 6).map((s, i) => (
            <div
              key={s.student_id}
              className="rounded-2xl p-5 border hover:shadow-md transition-all"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{ background: colors[i % colors.length] + "18" }}
              >
                {medal(s.rank)}
              </div>

              <h3 className="font-heading font-bold text-foreground">
                {rewardTitle(s.rank, Number(s.total_points || 0))}
              </h3>

              <div
                className="mt-3 flex items-center gap-2 p-3 rounded-xl"
                style={{ background: "var(--muted)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: colors[i % colors.length] }}
                >
                  {initials(s)}
                </div>

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {fullName(s)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Number(s.total_points)} pts · Rank #{s.rank}
                  </p>
                </div>

                <Award
                  size={15}
                  className="ml-auto flex-shrink-0"
                  style={{ color: colors[i % colors.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}