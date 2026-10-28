import { useEffect, useState } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { SportfestDayPicker } from "./SportfestDayPicker";
import {
  dayLongLabel,
  defaultDay,
  loadDays,
  type SportfestDay,
} from "../lib/sportfestDays";
import { getSettings } from "../lib/settings";
import { alertDialog } from "../lib/dialog";
import { FinePaymentModal, type FineForPayment } from "./FinePaymentModal";

interface Props {
  setScreen?: (screen: any) => void;
}

interface Activity {
  activity_id: number;
  activity_name: string;
  sport_name: string;
  activity_date: string;
  activity_time: string;
  activity_location: string;
  status: string;
}

interface AttendanceRecord {
  attendance_id: number | null;
  student_id: string;
  first_name: string;
  last_name: string;
  year_level: string;
  section: string;
  gender: string;

  attendance_date: string | null;
  time_in: string | null;
  time_out: string | null;

  attendance_status: "complete" | "no-time-out" | "absent" | "incomplete";

  fine: number;
  // false while the day is still going: the fine is worked out from the
  // scans so far and becomes final when the day is closed or has passed.
  fine_final: boolean;
  amount_paid: number;
  balance: number;
  payment_note: string | null; // latest note on a payment
  payment_status: "paid" | "partial" | "unpaid" | "none";
}

const money = (n: number) => `₱${Number(n || 0).toLocaleString("en-PH", { maximumFractionDigits: 2 })}`;

function formatTime(time: string | null) {
  if (!time) return "";

  // Handles MySQL TIME format such as 22:47:00
  if (/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    const [hour, minute] = time.split(":").map(Number);

    const date = new Date();
    date.setHours(hour, minute, 0, 0);

    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const parsed = new Date(time);

  if (Number.isNaN(parsed.getTime())) {
    return time;
  }

  return parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function FineMonitoring({ setScreen }: Props) {
  // Fines are per sportfest day (chosen on the Sportfest Days page).
  const [days, setDays] = useState<SportfestDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(
    null
  );

  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  /*
   * ---------------------------------------------------------
   * LOAD ACTIVITIES
   * ---------------------------------------------------------
   */

  const fetchDays = async () => {
    try {
      const list = await loadDays();
      setDays(list);

      // Start on today's sportfest day (or the most recent one).
      const first = defaultDay(list);
      if (first) {
        setSelectedDay(first.day_id);
      }
    } catch (error) {
      console.error("Failed to load sportfest days:", error);
      alertDialog("Failed to load sportfest days.");
    }
  };

  /*
   * ---------------------------------------------------------
   * LOAD ATTENDANCE
   * ---------------------------------------------------------
   */

  const fetchAttendance = async (dayId: number) => {
    try {
      setLoadingAttendance(true);

      const response = await apiFetch(
        `/api/attendance/day/${dayId}`
      );

      if (!response.ok) {
        throw new Error("Failed to load attendance");
      }

      const data = await response.json();

      const attendanceList: AttendanceRecord[] = Array.isArray(data)
        ? data
        : Array.isArray(data.attendance)
        ? data.attendance
        : [];

      setRecords(
        attendanceList.map((record: any) => ({
          attendance_id:
            record.attendance_id !== undefined
              ? Number(record.attendance_id)
              : null,

          student_id: String(record.student_id || ""),

          first_name: record.first_name || "",

          last_name: record.last_name || "",

          year_level: record.year_level || "",

          section: record.section || "",

          gender: record.gender || "",

          attendance_date: record.attendance_date || null,

          time_in: record.time_in || null,

          time_out: record.time_out || null,

          attendance_status:
            record.attendance_status || "absent",

          fine: Number(record.fine || 0),

          fine_final: Number(record.fine_final) === 1 || record.fine_final === true,

          amount_paid: Number(record.amount_paid || 0),

          balance: Number(record.balance ?? record.fine ?? 0),

          payment_note: record.payment_note || null,

          payment_status:
            Number(record.fine || 0) <= 0
              ? "none"
              : ["paid", "partial"].includes(record.payment_status)
              ? record.payment_status
              : "unpaid",
        }))
      );
    } catch (error) {
      console.error("Failed to load attendance:", error);
      alertDialog("Failed to load attendance records.");
      setRecords([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchDays();
      setLoading(false);
    };

    load();
  }, []);

  useEffect(() => {
    if (selectedDay !== null) {
      fetchAttendance(selectedDay);
    }
  }, [selectedDay]);

  /*
   * ---------------------------------------------------------
   * MARK FINE AS PAID
   * ---------------------------------------------------------
   */

  const [paying, setPaying] = useState<FineForPayment | null>(null);

  // Opens the payment window for one student's fine on this day.
  const openPayment = (record: AttendanceRecord) => {
    const day = days.find((d) => d.day_id === selectedDay);
    setPaying({
      student_id: record.student_id,
      name: `${record.first_name} ${record.last_name}`,
      dayLabel: day ? dayLongLabel(day) : "Sportfest day",
      day_id: selectedDay,
      fine: Number(record.fine || 0),
      amount_paid: Number(record.amount_paid || 0),
      balance: Number(record.balance || 0),
    });
  };

  /*
   * ---------------------------------------------------------
   * FILTER
   * ---------------------------------------------------------
   */

  const filtered = records.filter((record) => {
    const fullName =
      `${record.first_name} ${record.last_name}`.toLowerCase();

    const keyword = search.toLowerCase();

    const matchesSearch =
      fullName.includes(keyword) ||
      record.student_id.toLowerCase().includes(keyword);

    const matchesYear =
      yearFilter === "all" ||
      record.year_level === yearFilter;

    const matchesGender =
      genderFilter === "all" ||
      record.gender === genderFilter;

    return (
      matchesSearch &&
      matchesYear &&
      matchesGender
    );
  });

  /*
   * ---------------------------------------------------------
   * SUMMARY
   * ---------------------------------------------------------
   */

  const totalIssued = records.reduce(
    (sum, record) => sum + Number(record.fine || 0),
    0
  );

  const totalPaid = records.reduce(
    (sum, record) => sum + Number(record.amount_paid || 0),
    0
  );

  const totalOutstanding = Math.max(0, totalIssued - totalPaid);

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading fine monitoring...
      </div>
    );
  }

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  const selectedInfo = days.find((d) => d.day_id === selectedDay);
  const finePerScan = Number(getSettings().fine_per_missed_scan) || 0;

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Fine Monitoring
          </h2>

          <p className="text-muted-foreground text-sm">
            {selectedInfo
              ? `Fines for ${dayLongLabel(selectedInfo)}`
              : "Monitor attendance violations and automatically calculated fines."}
          </p>
        </div>
      </div>

      <SportfestDayPicker
        days={days}
        value={selectedDay}
        onChange={(id) => setSelectedDay(id)}
        mode="fines"
        onManageDays={setScreen ? () => setScreen("sportfest-days") : undefined}
      />

      {/* AUTOMATIC FINE POLICY */}

      <div
        className="rounded-2xl p-5 border"
        style={{
          background:
            "linear-gradient(135deg, #0F2450, #1E3A6E)",
          borderColor: "transparent",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">

          <div className="flex-1">

            <h3 className="font-heading font-bold text-white text-base">
              Automatic Fine Policy
            </h3>

            <p className="text-white/65 text-sm mt-1">
              Missing Time-In = ₱{finePerScan} · Missing Time-Out = ₱{finePerScan} ·
              Both Missed / Absent = ₱{finePerScan * 2}
            </p>

          </div>

          <div className="grid grid-cols-3 gap-3 sm:flex sm:gap-4">

            <div className="text-center">
              <p
                className="text-2xl font-heading font-bold"
                style={{ color: "#F59E0B" }}
              >
                ₱{finePerScan}
              </p>

              <p className="text-white/55 text-xs">
                Missing Time-In
              </p>
            </div>

            <div className="hidden sm:block w-px bg-white/15" />

            <div className="text-center">
              <p
                className="text-2xl font-heading font-bold"
                style={{ color: "#F59E0B" }}
              >
                ₱{finePerScan}
              </p>

              <p className="text-white/55 text-xs">
                Missing Time-Out
              </p>
            </div>

            <div className="hidden sm:block w-px bg-white/15" />

            <div className="text-center">
              <p className="text-2xl font-heading font-bold text-white">
                ₱{finePerScan * 2}
              </p>

              <p className="text-white/55 text-xs">
                Both Missed
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: "#2563EB18",
              color: "#2563EB",
            }}
          >
            <DollarSign size={18} />
          </div>

          <p
            className="text-2xl font-heading font-bold"
            style={{ color: "#2563EB" }}
          >
            ₱{totalIssued}
          </p>

          <p className="text-xs font-semibold text-foreground mt-0.5">
            Total Issued
          </p>

          <p className="text-xs text-muted-foreground">
            {records.filter((r) => r.fine > 0).length} fine record(s)
            {records.some((r) => r.fine > 0 && !r.fine_final) ? " · not final yet" : ""}
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: "#10B98118",
              color: "#10B981",
            }}
          >
            <CheckCircle size={18} />
          </div>

          <p
            className="text-2xl font-heading font-bold"
            style={{ color: "#10B981" }}
          >
            {money(totalPaid)}
          </p>

          <p className="text-xs font-semibold text-foreground mt-0.5">
            Collected
          </p>

          <p className="text-xs text-muted-foreground">
            {records.filter((r) => r.payment_status === "paid").length} paid ·{" "}
            {records.filter((r) => r.payment_status === "partial").length} partial
          </p>
        </div>

        <div
          className="rounded-2xl p-5 border"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
            style={{
              background: "#EF444418",
              color: "#EF4444",
            }}
          >
            <AlertTriangle size={18} />
          </div>

          <p
            className="text-2xl font-heading font-bold"
            style={{ color: "#EF4444" }}
          >
            {money(totalOutstanding)}
          </p>

          <p className="text-xs font-semibold text-foreground mt-0.5">
            Outstanding
          </p>

          <p className="text-xs text-muted-foreground">
            {
              records.filter(
                (r) =>
                  r.fine > 0 &&
                  r.payment_status !== "paid"
              ).length
            } pending
          </p>
        </div>

      </div>

      {/* SEARCH + FILTERS */}

      <div className="flex flex-col sm:flex-row gap-3">

        <div className="relative flex-1">

          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />

          <input
            type="text"
            placeholder="Search student by name or ID..."
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />

        </div>

        <select
          value={yearFilter}
          onChange={(e) =>
            setYearFilter(e.target.value)
          }
          className="px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">
            All Year Levels
          </option>

          <option value="1st Year">
            1st Year
          </option>

          <option value="2nd Year">
            2nd Year
          </option>

          <option value="3rd Year">
            3rd Year
          </option>

          <option value="4th Year">
            4th Year
          </option>
        </select>

        <select
          value={genderFilter}
          onChange={(e) =>
            setGenderFilter(e.target.value)
          }
          className="px-4 py-2.5 rounded-xl border text-sm outline-none"
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        >
          <option value="all">
            All Genders
          </option>

          <option value="Male">
            Male
          </option>

          <option value="Female">
            Female
          </option>
        </select>

      </div>

      {/* =====================================================
          THE TABLE YOU WANT
          ===================================================== */}

      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          background: "var(--card)",
          borderColor: "var(--border)",
        }}
      >

        <div className="overflow-x-auto">

          <table className="w-full min-w-[980px]">

            <thead>

              <tr
                style={{
                  background: "var(--muted)",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >

                {[
                  "Student",
                  "ID / Year Level",
                  "Time In",
                  "Time Out",
                  "Status",
                  "Fine",
                  "Paid",
                  "Balance",
                  "Payment Status",
                  "Notes",
                  "Action",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {heading}
                  </th>
                ))}

              </tr>

            </thead>

            <tbody
              className="divide-y"
              style={{
                borderColor: "var(--border)",
              }}
            >

              {loadingAttendance ? (

                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    Loading attendance records...
                  </td>
                </tr>

              ) : filtered.length === 0 ? (

                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-10 text-center text-sm text-muted-foreground"
                  >
                    No attendance records found.
                  </td>
                </tr>

              ) : (

                filtered.map((record, index) => {

                  const fullName =
                    `${record.first_name} ${record.last_name}`.trim();

                  const initials =
                    `${record.first_name?.[0] || ""}${record.last_name?.[0] || ""}`
                      .toUpperCase();

                  const statusInfo = {
                    label:
                      record.attendance_status ===
                      "complete"
                        ? "Complete"
                        : record.attendance_status ===
                          "no-time-out"
                        ? "No Time-Out"
                        : record.attendance_status ===
                          "absent"
                        ? "Absent"
                        : "Incomplete",

                    color:
                      record.attendance_status ===
                      "complete"
                        ? "#10B981"
                        : record.attendance_status ===
                          "no-time-out"
                        ? "#F59E0B"
                        : record.attendance_status ===
                          "absent"
                        ? "#EF4444"
                        : "#6B7280",
                  };

                  return (
                    <tr
                      key={record.student_id}
                      className="hover:bg-muted/30 transition-colors"
                    >

                      {/* STUDENT */}

                      <td className="px-5 py-3.5">

                        <div className="flex items-center gap-2">

                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{
                              background: `hsl(${
                                index * 36
                              }, 60%, 50%)`,
                            }}
                          >
                            {initials}
                          </div>

                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                            {fullName}
                          </span>

                        </div>

                      </td>

                      {/* ID / YEAR */}

                      <td className="px-5 py-3.5">

                        <p className="text-xs text-muted-foreground">
                          {record.student_id}
                        </p>

                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            background: "#2563EB15",
                            color: "var(--primary)",
                          }}
                        >
                          {record.year_level} -{" "}
                          {record.section}
                        </span>

                      </td>

                      {/* TIME IN */}

                      <td className="px-5 py-3.5">

                        {record.time_in ? (

                          <span
                            className="flex items-center gap-1 text-sm font-semibold"
                            style={{
                              color: "#10B981",
                            }}
                          >
                            <CheckCircle size={13} />

                            {formatTime(
                              record.time_in
                            )}
                          </span>

                        ) : (

                          <span
                            className="flex items-center gap-1 text-xs font-semibold"
                            style={{
                              color: "#EF4444",
                            }}
                          >
                            <XCircle size={13} />

                            Missing
                          </span>

                        )}

                      </td>

                      {/* TIME OUT */}

                      <td className="px-5 py-3.5">

                        {record.time_out ? (

                          <span
                            className="flex items-center gap-1 text-sm font-semibold"
                            style={{
                              color: "#10B981",
                            }}
                          >
                            <CheckCircle size={13} />

                            {formatTime(
                              record.time_out
                            )}
                          </span>

                        ) : (

                          <span
                            className="flex items-center gap-1 text-xs font-semibold"
                            style={{
                              color: "#EF4444",
                            }}
                          >
                            <XCircle size={13} />

                            Missing
                          </span>

                        )}

                      </td>

                      {/* STATUS */}

                      <td className="px-5 py-3.5">

                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{
                            background:
                              statusInfo.color +
                              "20",
                            color:
                              statusInfo.color,
                          }}
                        >
                          {statusInfo.label}
                        </span>

                      </td>

                      {/* FINE */}

                      <td className="px-5 py-3.5">

                        {Number(record.fine) > 0 ? (

                          <span
                            className="text-sm font-bold"
                            style={{
                              color: record.fine_final ? "#EF4444" : "#D97706",
                            }}
                          >
                            ₱{Number(record.fine)}
                          </span>

                        ) : (

                          <span className="text-xs text-green-600 font-semibold">
                            None
                          </span>

                        )}

                      </td>

                      {/* PAID */}

                      <td className="px-5 py-3.5 text-sm font-semibold whitespace-nowrap" style={{ color: record.amount_paid > 0 ? "#10B981" : "var(--muted-foreground)" }}>
                        {Number(record.fine) > 0 && record.fine_final ? money(record.amount_paid) : "–"}
                      </td>

                      {/* BALANCE */}

                      <td className="px-5 py-3.5 text-sm font-bold whitespace-nowrap" style={{ color: record.balance > 0 ? "#EF4444" : "#10B981" }}>
                        {Number(record.fine) > 0 && record.fine_final ? money(record.balance) : "–"}
                      </td>

                      {/* PAYMENT STATUS */}

                      <td className="px-5 py-3.5">
                        {(() => {
                          if (Number(record.fine) <= 0)
                            return <span className="text-xs text-green-600 font-semibold">No Fine</span>;
                          const look = !record.fine_final
                            ? { label: "Pending", bg: "#F59E0B20", fg: "#B45309" }
                            : record.payment_status === "paid"
                            ? { label: "Paid", bg: "#10B98120", fg: "#10B981" }
                            : record.payment_status === "partial"
                            ? { label: "Partial", bg: "#3B82F620", fg: "#2563EB" }
                            : { label: "Unpaid", bg: "#EF444420", fg: "#EF4444" };
                          return (
                            <span
                              className="text-xs px-2.5 py-1 rounded-full font-semibold whitespace-nowrap"
                              style={{ background: look.bg, color: look.fg }}
                              title={!record.fine_final ? "Final when this sportfest day is closed or has passed" : undefined}
                            >
                              {look.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* NOTES */}

                      <td className="px-5 py-3.5 max-w-[200px]">
                        {record.payment_note ? (
                          <span className="text-xs text-muted-foreground line-clamp-2" title={record.payment_note}>
                            {record.payment_note}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">–</span>
                        )}
                      </td>

                      {/* ACTION */}

                      <td className="px-5 py-3.5">
                        {Number(record.fine) > 0 && !record.fine_final ? (
                          <span className="text-xs text-muted-foreground">Collect after the day closes</span>
                        ) : Number(record.fine) > 0 ? (
                          record.payment_status === "paid" ? (
                            <button
                              onClick={() => openPayment(record)}
                              className="text-xs font-semibold text-green-600 hover:underline"
                            >
                              Settled · View
                            </button>
                          ) : (
                            <button
                              onClick={() => openPayment(record)}
                              className="text-xs px-3 py-1.5 rounded-xl font-bold text-white hover:opacity-80 transition-all whitespace-nowrap"
                              style={{ background: "#10B981" }}
                            >
                              {record.payment_status === "partial" ? "Add Payment" : "Record Payment"}
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">No Action</span>
                        )}
                      </td>

                    </tr>
                  );
                })

              )}

            </tbody>

          </table>

        </div>

      </div>


      {paying && (
        <FinePaymentModal
          fine={paying}
          onClose={() => setPaying(null)}
          onSaved={() => selectedDay !== null && fetchAttendance(selectedDay)}
        />
      )}
    </div>
  );
}