import { useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  XCircle,
  Award,
  Star,
  Calendar,
  MapPin,
  Download,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { openReportWindow, renderPrintableReport } from "../lib/reports";
import { alertDialog } from "../lib/dialog";

interface PassportActivity {
  activity_id: number;
  sport_name: string;
  activity_name: string;
  activity_date: string;
  activity_location: string;
  possible_participation_points: number;
  possible_accomplishment_points: number;
  time_in: string | null;
  time_out: string | null;
  attendance_status: string | null;
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

const sportIcon: Record<string, string> = {
  Basketball: "🏀",
  Volleyball: "🏐",
  Badminton: "🏸",
  PickleBall: "🏓",
  "Board Games": "♟️",
  "Larong Pinoy": "🏃",
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DigitalPassport() {
  const [activities, setActivities] = useState<PassportActivity[]>([]);
  const [summary, setSummary] = useState<PassportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fullName =
    user.full_name ||
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    "Student";

  useEffect(() => {
    const fetchPassport = async () => {
      if (!user.student_id) return;

      try {
        const response = await apiFetch(
          `/api/passport/${user.student_id}`
        );
        const data = await response.json();

        setActivities(data.activities || []);
        setSummary(data.summary || null);
      } catch {
        alertDialog("Failed to load passport data.");
      } finally {
        setLoading(false);
      }
    };

    fetchPassport();
  }, []);

  // Printable passport: opens in a new tab; "Save as PDF" in the print dialog.
  const downloadPassport = () => {
    const win = openReportWindow();
    const status = (a: PassportActivity) => {
      if (a.accomplishment_status === "accomplished") return "Accomplished";
      if (a.participation_status === "participated") return "Participated";
      if (a.time_in) return "Attended";
      return "Not yet";
    };

    renderPrintableReport(
      win,
      "Digital Sportfest Passport",
      `${fullName} · ${user.student_id || ""}${user.year_level ? ` · ${user.year_level}` : ""}${user.section ? ` - ${user.section}` : ""}`,
      [
        {
          heading: "Activities",
          rows: activities,
          columns: [
            { label: "Date", value: (a) => formatDate(a.activity_date) },
            { label: "Sport", value: (a) => a.sport_name },
            { label: "Activity", value: (a) => a.activity_name },
            { label: "Location", value: (a) => a.activity_location },
            { label: "Status", value: status },
            { label: "Participation Pts", value: (a) => Number(a.participation_points || 0) },
            { label: "Accomplishment Pts", value: (a) => Number(a.accomplishment_points || 0) },
          ],
        },
      ],
      [
        { label: "Completed activities", value: `${summary?.completed_activities ?? 0} of ${summary?.total_activities ?? 0}` },
        { label: "Participation points", value: summary?.participation_points ?? 0 },
        { label: "Accomplishment points", value: summary?.accomplishment_points ?? 0 },
        { label: "Total points", value: summary?.total_points ?? 0 },
      ]
    );
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading passport...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Digital Sportfest Passport
          </h2>
          <p className="text-muted-foreground text-sm">
            Your attendance, participation, accomplishments, and total points
          </p>
      
        </div>

        <button
          onClick={downloadPassport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <Download size={15} />
          Download PDF
        </button>
      </div>

      <div
        className="rounded-2xl overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #1E3A6E 0%, #2563EB 80%, #1E3A6E 100%)",
        }}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-widest">
              Cristal e-College
            </p>
            <p className="text-white font-heading font-bold text-sm">
              SPORTPASS DIGITAL PASSPORT
            </p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-xs">Sportfest 2026</p>
            <p className="text-white/50 text-xs">Computer Studies</p>
          </div>
        </div>

        <div className="p-5 flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-5">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
            style={{ background: "var(--accent)" }}
          >
            {fullName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)}
          </div>

          <div className="flex-1 min-w-0 w-full">
            <p className="text-white/40 text-xs uppercase tracking-wide">
              Full Name
            </p>
            <p className="text-white font-heading font-bold">{fullName}</p>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-wide">
                  Student ID
                </p>
                <p className="text-white text-sm font-semibold">
                  {user.student_id}
                </p>
              </div>

              <div>
                <p className="text-white/40 text-xs uppercase tracking-wide">
                  Year / Section
                </p>
                <p className="text-white text-sm font-semibold">
                  {user.year_level || "N/A"} - {user.section || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x border-t border-white/10">
          {[
            {
              label: "Activities",
              value: `${summary?.completed_activities || 0}/2`,
            },

            //  {
            //   label: "Activities",
            //   value: `${summary?.completed_activities || 0}/
            //   ${summary?.total_activities || 0}`,
            // },

            {
              label: "Participation points",
              value: summary?.participation_points || 0,
            },
            {
              label: "Accomplishment",
              value: summary?.accomplishment_points || 0,
            },
            {
              label: "Total Points",
              value: `${summary?.total_points || 0}/20`,
            },
          ].map((s) => (
            <div key={s.label} className="p-3 sm:p-4 text-center border-white/10 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0">
              <p className="text-xl font-heading font-bold text-white">
                {s.value}
              </p>
              <p className="text-white/50 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div
          className="px-5 py-3 flex items-center justify-between"
          style={{ background: "var(--accent)" }}
        >
          <p
            className="text-xs font-bold"
            style={{ color: "var(--accent-foreground)" }}
          >
            SPORTPASS · Valid for Sportfest 2026
          </p>
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--accent-foreground)" }}
          >
            Total: {summary?.total_points || 0} pts
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          {
            label: "Participation Points",
            value: summary?.participation_points || 0,
            icon: <Star size={18} />,
            color: "#2563EB",
          },
          {
            label: "Accomplishment Points",
            value: summary?.accomplishment_points || 0,
            icon: <Award size={18} />,
            color: "#F59E0B",
          },
          {
            label: "Total Points",
            value: summary?.total_points || 0,
            icon: <CheckCircle size={18} />,
            color: "#10B981",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-5 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
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
            <p className="text-xs font-semibold text-muted-foreground">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-heading font-bold text-foreground mb-4">
          Activity Passport Stamps
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map((a) => {
            const participated = a.participation_status === "participated";
            const accomplished = a.accomplishment_status === "accomplished";
            const attendanceComplete = !!a.time_in && !!a.time_out;

            return (
              <div
                key={a.activity_id}
                className="rounded-2xl p-5 border"
                style={{
                  background: "var(--card)",
                  borderColor: accomplished
                    ? "#10B981"
                    : participated
                    ? "#F59E0B"
                    : "var(--border)",
                  borderWidth: accomplished || participated ? 2 : 1,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl">
                    {sportIcon[a.sport_name] || "🏆"}
                  </div>

                  <div className="flex-1">
                    <h4 className="font-heading font-bold text-foreground">
                      {a.activity_name}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {a.sport_name}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(a.activity_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {a.activity_location || "No venue"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
                  <div
                    className="rounded-xl p-3"
                    style={{ background: attendanceComplete ? "#10B98118" : "#EF444418" }}
                  >
                    {attendanceComplete ? (
                      <CheckCircle size={16} style={{ color: "#10B981" }} />
                    ) : (
                      <Clock size={16} style={{ color: "#EF4444" }} />
                    )}
                    <p className="text-xs font-bold text-foreground mt-1">
                      Attendance
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {attendanceComplete ? "Complete" : "Incomplete"}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{ background: participated ? "#10B98118" : "#F59E0B18" }}
                  >
                    {participated ? (
                      <CheckCircle size={16} style={{ color: "#10B981" }} />
                    ) : (
                      <XCircle size={16} style={{ color: "#F59E0B" }} />
                    )}
                    <p className="text-xs font-bold text-foreground mt-1">
                      Participation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {participated
                        ? `+${a.participation_points} pts`
                        : `Possible +${a.possible_participation_points}`}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{ background: accomplished ? "#10B98118" : "#F59E0B18" }}
                  >
                    {accomplished ? (
                      <CheckCircle size={16} style={{ color: "#10B981" }} />
                    ) : (
                      <XCircle size={16} style={{ color: "#F59E0B" }} />
                    )}
                    <p className="text-xs font-bold text-foreground mt-1">
                      Accomplishment
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {accomplished
                        ? `+${a.accomplishment_points} pts`
                        : `Possible +${a.possible_accomplishment_points}`}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs text-muted-foreground">
                    Total Earned
                  </span>
                  <span
                    className="font-heading font-bold"
                    style={{ color: "var(--accent)" }}
                  >
                    {(a.participation_points || 0) +
                      (a.accomplishment_points || 0)}{" "}
                    pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {activities.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No activities available yet.
          </div>
        )}
      </div>
    </div>
  );
}