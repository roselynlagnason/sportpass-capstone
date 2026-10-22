import { useEffect, useRef, useState } from "react";
import { startCameraScanner, cameraErrorMessage, type CameraScanner } from "../lib/qrScanner";
import {
  QrCode,
  Search,
  CheckCircle,
  DollarSign,
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  Camera,
  RefreshCw,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { SportfestDayPicker } from "./SportfestDayPicker";
import {
  dayCanScan,
  dayLabel,
  dayLongLabel,
  defaultDay,
  loadDays,
  type SportfestDay,
} from "../lib/sportfestDays";
import { downloadCSV, fileStamp } from "../lib/reports";
import { formatTime as fmtTime } from "../lib/reportData";

const FINE_AMOUNT = 30;

interface Activity {
  activity_id: number;
  sport_name: string;
  activity_name: string;
  activity_date: string;
  activity_time: string;
  activity_location: string;
  status?: string;
}

interface AttendanceRecord {
  attendance_id: number | null;
  student_id: string;
  activity_id: number | null;

  attendance_date: string | null;

  time_in: string | null;
  time_out: string | null;

  attendance_status: string;
  fine: number;
  payment_status: "none" | "unpaid" | "paid" | "partial";

  first_name: string;
  last_name: string;
  year_level: string;
  section: string;
  gender: string;

}

function formatTime(value: string | null) {
  if (!value) return null;

  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusBadge(timeIn: string | null, timeOut: string | null) {
  if (timeIn && timeOut) return { label: "Complete", color: "#10B981" };
  if (timeIn && !timeOut) return { label: "No Time-Out", color: "#F59E0B" };
  return { label: "Incomplete", color: "#EF4444" };
}

export function Attendance({ setScreen }: { setScreen?: (screen: any) => void }) {
  // Attendance is taken per sportfest day (chosen on the Sportfest Days page).
  const [days, setDays] = useState<SportfestDay[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const [showScanner, setShowScanner] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [scanStatus, setScanStatus] = useState<"success" | "error" | "">("");
  const [scannedName, setScannedName] = useState("");

  const scannerRef = useRef<CameraScanner | null>(null);
  const scanLocked = useRef(false);

  const fetchDays = async () => {
    try {
      const list = await loadDays();
      setDays(list);

      // Start on today's sportfest day (or the most recent one).
      const first = defaultDay(list);
      if (first && selectedDay === null) {
        setSelectedDay(first.day_id);
      }
    } catch {
      console.log("Failed to fetch sportfest days");
    }
  };

  const fetchAttendance = async (dayId: number | null) => {
    if (!dayId) return;

    try {
      const response = await apiFetch(
        `/api/attendance/day/${dayId}`
      );
      const data = await response.json();

      setRecords(data);
    } catch {
      console.log("Failed to fetch attendance records");
    }
  };

  useEffect(() => {
    fetchDays();
  }, []);

  useEffect(() => {
    if (selectedDay) {
      fetchAttendance(selectedDay);
    }
  }, [selectedDay]);

  const stopScanner = async () => {
  try {
    await scannerRef.current?.clear();
    scannerRef.current = null;
  } catch {
    scannerRef.current = null;
  }
};

 const startScanner = async () => {
  setScanMessage("");
  setScanStatus("");
  setScannedName("");
  scanLocked.current = false;

  try {
    scannerRef.current?.clear().catch(() => {});

    scannerRef.current = await startCameraScanner(
        "attendance-reader",
      async (decodedText) => {
        if (scanLocked.current) return;
        scanLocked.current = true;

        scannerRef.current?.clear().catch(() => {});

        try {
          const response = await apiFetch("/api/attendance/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              token: decodedText,
              day_id: selectedDay,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            setScanStatus("error");
            setScanMessage(data.message || "Scan failed.");
            return;
          }

          setScanStatus("success");
          setScannedName(data.full_name || data.student_id);
          setScanMessage(data.message);

          fetchAttendance(selectedDay);
          fetchDays();
        } catch {
          setScanStatus("error");
          setScanMessage("Cannot connect to server.");
        }
      }
      );
  } catch (cameraError) {
    setScanStatus("error");
    setScanMessage(cameraErrorMessage(cameraError));
  }
};

  useEffect(() => {
    if (showScanner) {
      setTimeout(() => {
        startScanner();
      }, 300);
    }

    return () => {
      stopScanner();
    };
  }, [showScanner]);

  const closeScanner = async () => {
    await stopScanner();
    setShowScanner(false);
    setScanMessage("");
    setScanStatus("");
    setScannedName("");
  };

  const selected = days.find((d) => d.day_id === selectedDay);

  const filtered = records.filter((r) => {
  const fullName = `${r.first_name} ${r.last_name}`.toLowerCase();
  const keyword = search.toLowerCase();

  const matchesSearch =
    fullName.includes(keyword) ||
    r.student_id.toLowerCase().includes(keyword);

  const matchesYear =
    yearFilter === "all" || r.year_level === yearFilter;

  const matchesGender =
    genderFilter === "all" || r.gender === genderFilter;

  return matchesSearch && matchesYear && matchesGender;
});

 const totalStudents = records.length;

const present = records.filter(
  (r) => r.attendance_status !== "absent"
).length;

const absent = records.filter(
  (r) => r.attendance_status === "absent"
).length;

const noTimeout = records.filter(
  (r) => r.attendance_status === "no-time-out"
).length;

const estimatedFines = records.reduce(
  (sum, r) => sum + Number(r.fine || 0),
  0
);


const markPaid = async (attendanceId: number | null) => {
  if (!attendanceId) return alert("No attendance record found.");

  try {
    const response = await apiFetch(
      `/api/fines/${attendanceId}/mark-paid`,
      { method: "PUT" }
    );

    if (!response.ok) throw new Error();

    setRecords((prev) =>
      prev.map((r) =>
        r.attendance_id === attendanceId
          ? { ...r, payment_status: "paid" }
          : r
      )
    );
  } catch {
    alert("Failed to mark fine as paid.");
  }
};

const totalIssued = records.reduce((sum, r) => sum + Number(r.fine || 0), 0);

const totalPaid = records
  .filter((r) => r.payment_status === "paid")
  .reduce((sum, r) => sum + Number(r.fine || 0), 0);

const totalOutstanding = totalIssued - totalPaid;

// __________________________________________________________________________________________


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Attendance Monitoring
          </h2>
          <p className="text-muted-foreground text-sm">
            {selected
              ? `Attendance for ${dayLongLabel(selected)}`
              : "Scan students' time-based QR codes for automatic time-in and time-out"}
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowScanner(true)}
            disabled={!selected || !dayCanScan(selected)}
            title={
              selected && !dayCanScan(selected)
                ? "Scanning only works on the sportfest day itself, while it is open"
                : undefined
            }
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            <QrCode size={15} />
            Open Scanner
          </button>

          <button
            onClick={() => {
              const label = selected ? selected.date_key : "day";
              downloadCSV(
                `sportpass-attendance-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${fileStamp()}`,
                [
                  {
                    heading: selected ? `Attendance – ${dayLabel(selected, days)}` : "Attendance",
                    rows: records,
                    columns: [
                      { label: "Student ID", value: (r) => r.student_id },
                      { label: "Last Name", value: (r) => r.last_name },
                      { label: "First Name", value: (r) => r.first_name },
                      { label: "Year", value: (r) => r.year_level },
                      { label: "Section", value: (r) => r.section },
                      { label: "Time In", value: (r) => fmtTime(r.time_in) },
                      { label: "Time Out", value: (r) => fmtTime(r.time_out) },
                      { label: "Status", value: (r) => r.attendance_status },
                      { label: "Fine", value: (r) => Number(r.fine || 0) },
                      { label: "Payment", value: (r) => (Number(r.fine || 0) > 0 ? (r.payment_status === "paid" ? "Paid" : "Unpaid") : "") },
                    ],
                  },
                ]
              );
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
            style={{
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          >
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <SportfestDayPicker
        days={days}
        value={selectedDay}
        onChange={(id) => setSelectedDay(id)}
        mode="attendance"
        onManageDays={setScreen ? () => setScreen("sportfest-days") : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Students",
            value: totalStudents,
            icon: <QrCode size={18} />,
            color: "#2563EB",
          },

          {
            label: "Present",
            value: present,
            icon: <CheckCircle size={18} />,
            color: "#10B981",
          },

          {
            label: "Absent",
            value: absent,
            icon: <XCircle size={18} />,
            color: "#EF4444",
          },

          // {
          //   label: "Estimated Fines",
          //   value: `₱${estimatedFines}`,
          //   icon: <AlertTriangle size={18} />,
          //   color: "#F59E0B",
          // },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 border"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center mb-2"
              style={{ background: s.color + "18" }}
            >
              <span style={{ color: s.color }}>{s.icon}</span>
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

     
{/* Automatic Fine Policy____________________________________________________ */}

{/* <div
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
        Fines are computed from attendance QR scan records.
      </p>
    </div>

    <div className="flex gap-4">
      <div className="text-center">
        <p className="text-2xl font-heading font-bold" style={{ color: "#F59E0B" }}>
          ₱30
        </p>
        <p className="text-white/55 text-xs">Missing Time-In</p>
      </div>

      <div className="w-px bg-white/15" />

      <div className="text-center">
        <p className="text-2xl font-heading font-bold" style={{ color: "#F59E0B" }}>
          ₱30
        </p>
        <p className="text-white/55 text-xs">Missing Time-Out</p>
      </div>

      <div className="w-px bg-white/15" />

      <div className="text-center">
        <p className="text-2xl font-heading font-bold text-white">₱60</p>
        <p className="text-white/55 text-xs">Both Missed</p>
      </div>
    </div>
  </div>
</div> */}
{/* 
<div className="grid grid-cols-3 gap-4">
  {[
    {
      label: "Total Issued",
      value: `₱${totalIssued}`,
      sub: `${records.filter((r) => Number(r.fine || 0) > 0).length} fine record(s)`,
      color: "#2563EB",
      icon: <DollarSign size={18} />,
    },
    {
      label: "Collected",
      value: `₱${totalPaid}`,
      sub: `${records.filter((r) => r.payment_status === "paid").length} paid`,
      color: "#10B981",
      icon: <CheckCircle size={18} />,
    },
    {
      label: "Outstanding",
      value: `₱${totalOutstanding}`,
      sub: `${records.filter((r) => Number(r.fine || 0) > 0 && r.payment_status !== "paid").length} pending`,
      color: "#EF4444",
      icon: <AlertTriangle size={18} />,
    },
  ].map((s) => (
    <div
      key={s.label}
      className="rounded-2xl p-5 border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: s.color + "18", color: s.color }}
      >
        {s.icon}
      </div>

      <p className="text-2xl font-heading font-bold" style={{ color: s.color }}>
        {s.value}
      </p>

      <p className="text-xs font-semibold text-foreground mt-0.5">
        {s.label}
      </p>
      <p className="text-xs text-muted-foreground">{s.sub}</p>
    </div>
  ))}
</div>

 */}






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
      onChange={(e) => setSearch(e.target.value)}
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
    onChange={(e) => setYearFilter(e.target.value)}
    className="px-4 py-2.5 rounded-xl border text-sm outline-none"
    style={{
      background: "var(--card)",
      borderColor: "var(--border)",
      color: "var(--foreground)",
    }}
  >
    <option value="all">All Year Levels</option>
    <option value="1st Year">1st Year</option>
    <option value="2nd Year">2nd Year</option>
    <option value="3rd Year">3rd Year</option>
    <option value="4th Year">4th Year</option>
  </select>

  <select
    value={genderFilter}
    onChange={(e) => setGenderFilter(e.target.value)}
    className="px-4 py-2.5 rounded-xl border text-sm outline-none"
    style={{
      background: "var(--card)",
      borderColor: "var(--border)",
      color: "var(--foreground)",
    }}
  >
    <option value="all">All Genders</option>
    <option value="Male">Male</option>
    <option value="Female">Female</option>
  </select>
</div>

      <div
          className="rounded-2xl border overflow-hidden"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  background: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {[
                  "Student",
                  "ID / Year Level",
                  "Time In",
                  "Time Out",
                  "Status",
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
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-sm text-muted-foreground"
                  >
                    No attendance records yet. Start scanning student QR codes.
                  </td>
                </tr>
              ) : (
                filtered.map((r, i) => {
                  const fullName = `${r.first_name} ${r.last_name}`;
                 const st = {
                    label:
                      r.attendance_status === "complete"
                        ? "Complete"
                        : r.attendance_status === "no-time-out"
                        ? "No Time-Out"
                        : r.attendance_status === "absent"
                        ? "Absent"
                        : "Incomplete",

                    color:
                      r.attendance_status === "complete"
                        ? "#10B981"
                        : r.attendance_status === "no-time-out"
                        ? "#F59E0B"
                        : r.attendance_status === "absent"
                        ? "#EF4444"
                        : "#6B7280",
                  };
                 const fine = r.fine;

                  return (
                    <tr
                      key={r.student_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{
                              background: `hsl(${i * 36}, 60%, 50%)`,
                            }}
                          >
                            {fullName.charAt(0)}
                          </div>

                          <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                            {fullName}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <p className="text-xs text-muted-foreground">
                          {r.student_id}
                        </p>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            background: "#2563EB15",
                            color: "var(--primary)",
                          }}
                        >
                          {r.year_level} - {r.section}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
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

                      <td className="px-5 py-3.5">
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

                      <td className="px-5 py-3.5">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-semibold"
                          style={{
                            background: st.color + "20",
                            color: st.color,
                          }}
                        >
                          {st.label}
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




      {showScanner && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 text-center shadow-2xl"
            style={{ background: "var(--card)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-bold text-foreground">
                Attendance Scanner
              </h3>

              <button
                onClick={closeScanner}
                className="text-muted-foreground hover:text-foreground text-xl"
              >
                ×
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 mb-3">
              <Camera size={16} style={{ color: "var(--primary)" }} />
              <p className="text-xs font-semibold text-muted-foreground">
                Point camera at the student's time-based QR code
              </p>
            </div>

            <div
              id="attendance-reader"
              className="rounded-xl overflow-hidden border bg-black min-h-[280px]"
              style={{ borderColor: "var(--border)" }}
            />

            {scanStatus && (
              <div
                className="mt-4 p-3 rounded-xl"
                style={{
                  background:
                    scanStatus === "success" ? "#10B98118" : "#EF444418",
                }}
              >
                {scanStatus === "success" ? (
                  <CheckCircle
                    size={34}
                    className="mx-auto mb-2"
                    style={{ color: "#10B981" }}
                  />
                ) : (
                  <AlertTriangle
                    size={34}
                    className="mx-auto mb-2"
                    style={{ color: "#EF4444" }}
                  />
                )}

                {scannedName && (
                  <p className="text-sm font-bold text-foreground">
                    {scannedName}
                  </p>
                )}

                <p
                  className="text-xs font-semibold"
                  style={{
                    color: scanStatus === "success" ? "#10B981" : "#EF4444",
                  }}
                >
                  {scanMessage}
                </p>
              </div>
            )}

            <button
              onClick={startScanner}
              className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: "var(--primary)" }}
            >
              <RefreshCw size={15} />
              Scan Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}