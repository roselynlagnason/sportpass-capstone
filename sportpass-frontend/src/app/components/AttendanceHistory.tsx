import { useEffect, useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { alertDialog } from "../lib/dialog";
import { getSettings } from "../lib/settings";

interface HistoryRecord {
  attendance_id: number | null; // null = no scans at all that day (absent)
  day_id: number;
  fine: number; // worked out by the server, same rules as the dashboard
  fine_final: boolean; // false while the day is still open (today)
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  activity_name: string;
  sport_name: string;
  activity_location: string;
  payment_status?: "unpaid" | "partial" | "paid" | "none" | "pending";
}

const statusConfig = {
  paid: { label: "Paid", color: "#10B981", bg: "#10B98120" },
  unpaid: { label: "Unpaid", color: "#EF4444", bg: "#EF444420" },
  partial: { label: "Partial", color: "#F59E0B", bg: "#F59E0B20" },
  none: { label: "No Fine", color: "#6B7280", bg: "#6B728020" },
  pending: { label: "Pending", color: "#B45309", bg: "#F59E0B20" },
};

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

function getStatus(r: HistoryRecord) {
  if (r.time_in && r.time_out) {
    return { label: "Complete", color: "#10B981", icon: <CheckCircle size={14} /> };
  }

  if (r.time_in && !r.time_out) {
    return { label: "No Time-Out", color: "#F59E0B", icon: <Clock size={14} /> };
  }

  return { label: "Absent", color: "#EF4444", icon: <XCircle size={14} /> };
}

function getFine(r: HistoryRecord) {
  return Number(r.fine || 0);
}

export function AttendanceHistory() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const historyRes = await apiFetch(
          `/api/attendance/history/${user.student_id}`
        );
        const historyData = await historyRes.json();
        if (!historyRes.ok || !Array.isArray(historyData)) throw new Error();

        const merged = historyData.map((record: any) => {
          const fine = Number(record.fine || 0);
          const final = Number(record.fine_final) === 1 || record.fine_final === true;
          return {
            ...record,
            fine,
            fine_final: final,
            payment_status:
              fine <= 0 ? "none" : !final ? "pending" : ["paid", "partial"].includes(record.payment_status) ? record.payment_status : "unpaid",
          };
        });

        setHistory(merged);
      } catch {
        alertDialog("Failed to load attendance history.");
      } finally {
        setLoading(false);
      }
    };

    if (user.student_id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, []);

  const complete = history.filter((r) => r.time_in && r.time_out).length;

  const attendanceRate =
    history.length > 0 ? Math.round((complete / history.length) * 100) : 0;

  // Only final fines (day closed or past) count, same as the dashboard.
  const owed = history.filter((r) => r.payment_status === "unpaid" || r.payment_status === "partial");
  const outstandingFines = owed.reduce((sum, r: any) => sum + Number(r.balance ?? getFine(r)), 0);
  const fineCount = owed.length;
  const finePerScan = Number(getSettings().fine_per_missed_scan) || 30;

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading attendance history...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          Attendance History
        </h2>
        <p className="text-muted-foreground text-sm">
          View your attendance records, fines, and payment status
        </p>
      </div>

      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background:
            outstandingFines > 0
              ? "linear-gradient(135deg, #7F1D1D, #DC2626)"
              : "linear-gradient(135deg, #064E3B, #10B981)",
        }}
      >
        <div className="relative z-10">
          <p className="text-white/70 text-sm mb-1">
            {outstandingFines > 0 ? "Outstanding Balance" : "No Outstanding Fines"}
          </p>

          <p className="text-4xl font-heading font-bold">
            ₱{outstandingFines}
          </p>

          <p className="text-white/70 text-sm mt-2">
            {outstandingFines > 0
              ? `${fineCount} unpaid fine record${fineCount > 1 ? "s" : ""} · Please settle with the admin`
              : "You're all clear! Keep attending events on time."}
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{
          background: "linear-gradient(135deg, #0F2450, #1E3A6E)",
          borderColor: "transparent",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h3 className="font-heading font-bold text-white text-base">
              Automatic Fine Policy
            </h3>
            <p className="text-white/65 text-sm mt-1">
              Fines are computed from attendance QR scan records and become final when the sportfest day is closed or over.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-4">
            <div className="text-center">
              <p className="text-2xl font-heading font-bold" style={{ color: "#F59E0B" }}>
                ₱{finePerScan}
              </p>
              <p className="text-white/55 text-xs">Missing Time-In</p>
            </div>

            <div className="hidden sm:block w-px bg-white/15" />

            <div className="text-center">
              <p className="text-2xl font-heading font-bold" style={{ color: "#F59E0B" }}>
                ₱{finePerScan}
              </p>
              <p className="text-white/55 text-xs">Missing Time-Out</p>
            </div>

            <div className="hidden sm:block w-px bg-white/15" />

            <div className="text-center">
              <p className="text-2xl font-heading font-bold text-white">
                ₱{finePerScan * 2}
              </p>
              <p className="text-white/55 text-xs">Both Missed / Absent</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div
          className="rounded-2xl p-3 sm:p-4 border text-center"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <CheckCircle size={22} className="mx-auto mb-2" style={{ color: "#10B981" }} />
          <p className="text-xl sm:text-2xl font-heading font-bold" style={{ color: "#10B981" }}>
            {complete}/{history.length}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Complete Records
          </p>
        </div>

        <div
          className="rounded-2xl p-3 sm:p-4 border text-center"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <Clock size={22} className="mx-auto mb-2" style={{ color: "#2563EB" }} />
          <p
            className="text-2xl font-heading font-bold"
            style={{ color: attendanceRate >= 80 ? "#10B981" : "#EF4444" }}
          >
            {attendanceRate}%
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Attendance Rate
          </p>
        </div>

        <div
          className="rounded-2xl p-3 sm:p-4 border text-center"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <DollarSign size={22} className="mx-auto mb-2" style={{ color: "#EF4444" }} />
          <p className="text-2xl font-heading font-bold" style={{ color: "#EF4444" }}>
            ₱{outstandingFines}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Outstanding Fines
          </p>
        </div>
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr
                style={{
                  background: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {[
                  "Date",
                  "Time In",
                  "Time Out",
                  "Status",
                  "Fine",
                  "Payment Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    No sportfest days yet.
                  </td>
                </tr>
              ) : (
                history.map((r) => {
                  const st = getStatus(r);
                  const fine = getFine(r);
                  const payment =
                    statusConfig[r.payment_status || "none"] || statusConfig.none;

                  return (
                    <tr
                      key={r.day_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-foreground whitespace-nowrap">
                        {formatDate(r.attendance_date)}
                      </td>

                      <td className="px-5 py-4">
                        {r.time_in ? (
                          <span
                            className="flex items-center gap-1 text-sm font-semibold"
                            style={{ color: "#10B981" }}
                          >
                            <CheckCircle size={13} />
                            {formatTime(r.time_in)}
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-xs font-semibold"
                            style={{ color: "#EF4444" }}
                          >
                            <XCircle size={13} />
                            Missing
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {r.time_out ? (
                          <span
                            className="flex items-center gap-1 text-sm font-semibold"
                            style={{ color: "#10B981" }}
                          >
                            <CheckCircle size={13} />
                            {formatTime(r.time_out)}
                          </span>
                        ) : (
                          <span
                            className="flex items-center gap-1 text-xs font-semibold"
                            style={{ color: "#EF4444" }}
                          >
                            <XCircle size={13} />
                            Missing
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 w-fit"
                          style={{
                            background: st.color + "20",
                            color: st.color,
                          }}
                        >
                          {st.icon}
                          {st.label}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {fine > 0 ? (
                          <span
                            className="text-sm font-bold"
                            style={{
                              color:
                                r.payment_status === "paid"
                                  ? "#10B981"
                                  : r.payment_status === "pending"
                                  ? "#D97706"
                                  : "#EF4444",
                            }}
                          >
                            ₱{fine}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 font-semibold">
                            None
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{
                            background: payment.bg,
                            color: payment.color,
                          }}
                        >
                          {payment.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {outstandingFines > 0 && (
        <div
          className="rounded-2xl p-5 border"
          style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={16} style={{ color: "var(--primary)" }} />
            <h3
              className="font-heading font-bold text-sm"
              style={{ color: "var(--primary)" }}
            >
              How to Pay
            </h3>
          </div>

          <p className="text-sm text-blue-800">
            Proceed to the <strong>SPORTPASS Admin Office</strong> or approach
            the assigned event officer. Bring your Student ID. This system only
            monitors fine status and does not process online payments.
          </p>
        </div>
      )}
    </div>
  );
}