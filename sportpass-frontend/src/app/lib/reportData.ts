import { apiFetch } from "./api";
import { rewardFor } from "./rewards";
import type { ReportSection } from "./reports";

// Builds the data for each report on the Reports page.

export const REPORT_TITLES = [
  "Student Performance Report",
  "Activity Completion Report",
  "Attendance Summary",
  "Rankings & Awards Report",
  "Fine Monitoring Report",
  "Comprehensive Sportfest Report",
] as const;

export type ReportTitle = (typeof REPORT_TITLES)[number];

export type BuiltReport = {
  subtitle: string;
  sections: ReportSection[];
  summary: { label: string; value: unknown }[];
};

async function getJSON(path: string) {
  const response = await apiFetch(path);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `Failed to load ${path}`);
  return data;
}

export function formatDate(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(value: unknown) {
  if (!value) return "";
  const text = String(value);
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    const [h, m] = text.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime())
    ? text
    : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const peso = (n: unknown) => `₱${Number(n || 0).toLocaleString("en-US")}`;
const name = (r: any) => `${r.last_name || ""}, ${r.first_name || ""}`.replace(/^, |, $/g, "");

function performanceSection(rankings: any[]): ReportSection {
  return {
    heading: "Student Performance",
    rows: rankings,
    columns: [
      { label: "Rank", value: (r) => r.rank },
      { label: "Student ID", value: (r) => r.student_id },
      { label: "Name", value: name },
      { label: "Year", value: (r) => r.year_level },
      { label: "Section", value: (r) => r.section },
      { label: "Activities Joined", value: (r) => r.activities_joined },
      { label: "Participation Pts", value: (r) => Number(r.participation_points || 0) },
      { label: "Accomplishment Pts", value: (r) => Number(r.accomplishment_points || 0) },
      { label: "Total Points", value: (r) => Number(r.total_points || 0) },
    ],
  };
}

function rankingSection(rankings: any[]): ReportSection {
  return {
    heading: "Rankings & Reward Eligibility",
    rows: rankings,
    columns: [
      { label: "Rank", value: (r) => r.rank },
      { label: "Student ID", value: (r) => r.student_id },
      { label: "Name", value: name },
      { label: "Year", value: (r) => r.year_level },
      { label: "Total Points", value: (r) => Number(r.total_points || 0) },
      { label: "Reward Eligibility", value: (r) => rewardFor(r.rank, Number(r.total_points || 0)) },
    ],
  };
}

function yearLevelSection(rankings: any[]): ReportSection {
  const byYear: Record<string, { year: string; students: number; points: number }> = {};
  rankings.forEach((r) => {
    const key = r.year_level || "Unknown";
    byYear[key] ||= { year: key, students: 0, points: 0 };
    byYear[key].students += 1;
    byYear[key].points += Number(r.total_points || 0);
  });
  const rows = Object.values(byYear).sort((a, b) => b.points - a.points);
  return {
    heading: "Year Level Ranking",
    rows,
    columns: [
      { label: "Rank", value: (r) => rows.indexOf(r) + 1 },
      { label: "Year Level", value: (r) => r.year },
      { label: "Students", value: (r) => r.students },
      { label: "Total Points", value: (r) => r.points },
      { label: "Average Points", value: (r) => (r.students ? Math.round(r.points / r.students) : 0) },
    ],
  };
}

function activitySection(activities: any[]): ReportSection {
  return {
    heading: "Activity Completion",
    rows: activities,
    columns: [
      { label: "Date", value: (r) => formatDate(r.activity_date) },
      { label: "Time", value: (r) => formatTime(r.activity_time) },
      { label: "Sport", value: (r) => r.sport_name },
      { label: "Activity", value: (r) => r.activity_name },
      { label: "Location", value: (r) => r.activity_location },
      { label: "Status", value: (r) => r.status },
      { label: "Attended", value: (r) => r.attended },
      { label: "Complete Time-in/out", value: (r) => r.completed_attendance },
      { label: "Participated", value: (r) => r.participated },
      { label: "Accomplished", value: (r) => r.accomplished },
      { label: "Points Awarded", value: (r) => Number(r.points_awarded || 0) },
    ],
  };
}

function attendanceSection(rows: any[]): ReportSection {
  return {
    heading: "Attendance Records",
    rows,
    columns: [
      { label: "Date", value: (r) => formatDate(r.attendance_date) },
      { label: "Activity", value: (r) => `${r.sport_name} – ${r.activity_name}` },
      { label: "Student ID", value: (r) => r.student_id },
      { label: "Name", value: name },
      { label: "Year / Section", value: (r) => [r.year_level, r.section].filter(Boolean).join(" - ") },
      { label: "Time In", value: (r) => formatTime(r.time_in) || "Missed" },
      { label: "Time Out", value: (r) => formatTime(r.time_out) || "Missed" },
    ],
  };
}

const fineLabel: Record<string, string> = {
  attendance: "Missed scan",
  absence: "Absent",
  manual: "Manual",
};

function fineSection(fines: any[]): ReportSection {
  return {
    heading: "Fines",
    rows: fines,
    columns: [
      { label: "Date", value: (r) => formatDate(r.attendance_date) },
      { label: "Student ID", value: (r) => r.student_id },
      { label: "Name", value: name },
      { label: "Activity", value: (r) => `${r.sport_name} – ${r.activity_name}` },
      { label: "Type", value: (r) => fineLabel[r.fine_type] || r.fine_type },
      { label: "Missed", value: (r) => [Number(r.missed_in) ? "Time-in" : "", Number(r.missed_out) ? "Time-out" : ""].filter(Boolean).join(" + ") },
      { label: "Amount", value: (r) => peso(r.amount) },
      { label: "Paid", value: (r) => peso(r.amount_paid ?? (r.payment_status === "paid" ? r.amount : 0)) },
      { label: "Balance", value: (r) => peso(r.balance ?? (r.payment_status === "paid" ? 0 : r.amount)) },
      { label: "Status", value: (r) => (r.payment_status === "paid" ? "Paid" : r.payment_status === "partial" ? "Partial" : "Unpaid") },
      { label: "Note", value: (r) => r.payment_note || "" },
    ],
  };
}

function fineTotals(fines: any[]) {
  const total = fines.reduce((s, f) => s + Number(f.amount || 0), 0);
  const paid = fines.reduce(
    (s, f) => s + Number(f.amount_paid ?? (f.payment_status === "paid" ? f.amount : 0) ?? 0),
    0
  );
  return [
    { label: "Fines issued", value: peso(total) },
    { label: "Collected", value: peso(paid) },
    { label: "Outstanding", value: peso(total - paid) },
    { label: "Fine records", value: fines.length },
  ];
}

export async function buildReport(title: ReportTitle): Promise<BuiltReport> {
  switch (title) {
    case "Student Performance Report": {
      const rankings = await getJSON("/api/rankings");
      const total = rankings.reduce((s: number, r: any) => s + Number(r.total_points || 0), 0);
      return {
        subtitle: "Participation, accomplishments and total points per student",
        sections: [performanceSection(rankings)],
        summary: [
          { label: "Students", value: rankings.length },
          { label: "Active students", value: rankings.filter((r: any) => Number(r.total_points) > 0).length },
          { label: "Total points", value: total },
          { label: "Average points", value: rankings.length ? Math.round(total / rankings.length) : 0 },
        ],
      };
    }
    case "Activity Completion Report": {
      const activities = await getJSON("/api/reports/activities");
      return {
        subtitle: "Attendance, participation and accomplishment per activity",
        sections: [activitySection(activities)],
        summary: [
          { label: "Activities", value: activities.length },
          { label: "Completed", value: activities.filter((a: any) => a.status === "completed").length },
        ],
      };
    }
    case "Attendance Summary": {
      const rows = await getJSON("/api/reports/attendance");
      return {
        subtitle: "Time-in and time-out records",
        sections: [attendanceSection(rows)],
        summary: [
          { label: "Records", value: rows.length },
          { label: "Complete", value: rows.filter((r: any) => r.time_in && r.time_out).length },
          { label: "Missing a scan", value: rows.filter((r: any) => !r.time_in || !r.time_out).length },
        ],
      };
    }
    case "Rankings & Awards Report": {
      const rankings = await getJSON("/api/rankings");
      return {
        subtitle: "Individual and year level rankings with reward eligibility",
        sections: [rankingSection(rankings), yearLevelSection(rankings)],
        summary: [],
      };
    }
    case "Fine Monitoring Report": {
      const fines = await getJSON("/api/fines");
      return {
        subtitle: "Attendance-related fines and payment status",
        sections: [fineSection(fines)],
        summary: fineTotals(fines),
      };
    }
    case "Comprehensive Sportfest Report": {
      const [rankings, activities, attendance, fines] = await Promise.all([
        getJSON("/api/rankings"),
        getJSON("/api/reports/activities"),
        getJSON("/api/reports/attendance"),
        getJSON("/api/fines"),
      ]);
      return {
        subtitle: "Full summary of SPORTPASS records",
        sections: [
          activitySection(activities),
          rankingSection(rankings),
          yearLevelSection(rankings),
          performanceSection(rankings),
          attendanceSection(attendance),
          fineSection(fines),
        ],
        summary: [
          { label: "Students", value: rankings.length },
          { label: "Activities", value: activities.length },
          { label: "Attendance records", value: attendance.length },
          ...fineTotals(fines).slice(0, 3),
        ],
      };
    }
  }
}
