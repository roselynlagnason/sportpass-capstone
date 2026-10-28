import { useEffect, useState } from "react";
import {
  Download,
  Users,
  Calendar,
  Star,
  ClipboardList,
  Trophy,
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
import {
  downloadCSV,
  fileStamp,
  openReportWindow,
  renderPrintableReport,
} from "../lib/reports";
import { buildReport, type ReportTitle } from "../lib/reportData";
import { alertDialog } from "../lib/dialog";

interface ReportSummary {
  total_students: number;
  total_activities: number;
  participation_points: number;
  accomplishment_points: number;
  total_points: number;
  total_attendance: number;
  year_level_points: {
    year_level: string;
    points: string | number;
  }[];
}

const colors = ["#2563EB", "#F59E0B", "#10B981", "#8B5CF6", "#EF4444"];

export function Reports() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const response = await apiFetch("/api/reports/summary");
      const data = await response.json();
      setSummary(data);
    } catch {
      alertDialog("Failed to load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // PDF: opens a printable report in a new tab (choose "Save as PDF").
  // Excel: downloads a .csv file that opens in Excel.
  const generate = async (title: ReportTitle, format: "pdf" | "csv") => {
    const win = format === "pdf" ? openReportWindow() : null;
    setGenerating(`${title}:${format}`);

    try {
      const report = await buildReport(title);

      if (format === "pdf") {
        renderPrintableReport(win, title, report.subtitle, report.sections, report.summary);
      } else {
        const slug = title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-");
        downloadCSV(`sportpass-${slug}-${fileStamp()}`, report.sections);
      }
    } catch (error) {
      win?.close();
      alertDialog(error instanceof Error ? error.message : "Failed to generate report.");
    } finally {
      setGenerating(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading reports...
      </div>
    );
  }

  const yearLevelData =
    summary?.year_level_points?.map((y) => ({
      name: y.year_level || "Unknown",
      points: Number(y.points || 0),
    })) || [];

  const reportTypes: { title: ReportTitle; desc: string; icon: string; color: string }[] = [
    {
      title: "Student Performance Report",
      desc: "Participation, accomplishments, and total points",
      icon: "📈",
      color: "#2563EB",
    },
    {
      title: "Activity Completion Report",
      desc: "Activity-wise participation and accomplishment summary",
      icon: "✅",
      color: "#10B981",
    },
    {
      title: "Attendance Summary",
      desc: "Time-in and time-out attendance records",
      icon: "📋",
      color: "#F59E0B",
    },
    {
      title: "Rankings & Awards Report",
      desc: "Top performers and reward eligibility",
      icon: "🏆",
      color: "#8B5CF6",
    },
    {
      title: "Fine Monitoring Report",
      desc: "Missing scan fines and payment status",
      icon: "💰",
      color: "#EF4444",
    },
    {
      title: "Comprehensive Sportfest Report",
      desc: "Full summary of SPORTPASS records",
      icon: "📄",
      color: "#6B7280",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Reports
          </h2>
          <p className="text-muted-foreground text-sm">
            Live sportfest reports based on attendance, participation, and points
          </p>
        </div>

        <button
          onClick={() => generate("Comprehensive Sportfest Report", "pdf")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all"
          style={{ background: "var(--primary)" }}
        >
          <Download size={15} />
          Export All
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: summary?.total_students || 0,
            icon: <Users size={18} />,
            color: "#2563EB",
          },
          {
            label: "Total Activities",
            value: summary?.total_activities || 0,
            icon: <Calendar size={18} />,
            color: "#10B981",
          },
          {
            label: "Total Attendance",
            value: summary?.total_attendance || 0,
            icon: <ClipboardList size={18} />,
            color: "#8B5CF6",
          },
          {
            label: "Total Points",
            value: summary?.total_points || 0,
            icon: <Star size={18} />,
            color: "#F59E0B",
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div
          className="rounded-2xl p-5 border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="font-heading font-bold text-foreground mb-2">
            Participation Points
          </h3>
          <p className="text-3xl font-heading font-bold text-blue-600">
            {summary?.participation_points || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Points earned from joining activities
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="font-heading font-bold text-foreground mb-2">
            Accomplishment Points
          </h3>
          <p className="text-3xl font-heading font-bold text-yellow-500">
            {summary?.accomplishment_points || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Points earned from completing activities
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <h3 className="font-heading font-bold text-foreground mb-2">
            Overall Points
          </h3>
          <p className="text-3xl font-heading font-bold text-green-600">
            {summary?.total_points || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Combined participation and accomplishment points
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h3 className="font-heading font-bold text-foreground mb-1">
          Points by Year Level
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Total accumulated points grouped by year level
        </p>

        {yearLevelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
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
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No year level point data yet.
          </div>
        )}
      </div>

      <div>
        <h3 className="font-heading font-bold text-foreground mb-4">
          Generate Reports
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportTypes.map((r) => (
            <div
              key={r.title}
              className="rounded-2xl p-5 border hover:shadow-md transition-all"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: r.color + "15" }}
                >
                  {r.icon}
                </div>

                <div className="flex-1">
                  <h4 className="font-bold text-foreground text-sm">
                    {r.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.desc}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => generate(r.title, "pdf")}
                  className="flex-1 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
                  style={{ background: r.color }}
                >
                  {generating === `${r.title}:pdf` ? (
                    <>
                      <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download size={12} />
                      PDF
                    </>
                  )}
                </button>

                <button
                  onClick={() => generate(r.title, "csv")}
                  className="py-2 px-3 rounded-xl border text-xs font-semibold hover:bg-muted transition-all"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{
          background: "linear-gradient(135deg, #0F2450, #1E3A6E)",
          borderColor: "transparent",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: "#F59E0B20" }}
          >
            <Trophy size={24} style={{ color: "#F59E0B" }} />
          </div>

          <div>
            <h3 className="font-heading font-bold text-white">
              SPORTPASS Report Summary
            </h3>
            <p className="text-white/65 text-sm">
              The system currently tracks {summary?.total_students || 0} students,
              {` ${summary?.total_activities || 0} `}
              activities, and {summary?.total_points || 0} total performance
              points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}