import { useEffect, useState } from "react";
import {
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { apiFetch } from "../lib/api";

const FINE_PER_VIOLATION = 30;

interface FineRecord {
  attendance_id: number;
  student_id: string;
  activity_id: number;
  attendance_date: string;
  time_in: string | null;
  time_out: string | null;
  first_name: string;
  last_name: string;
  year_level: string;
  section: string;
  sport_name: string;
  activity_name: string;
  missed_in: boolean;
  missed_out: boolean;
  amount: number;
  payment_status: "unpaid" | "partial" | "paid" | "none";
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: "#10B981", bg: "#10B98115" },
  unpaid: { label: "Unpaid", color: "#EF4444", bg: "#EF444415" },
  partial: { label: "Partial", color: "#F59E0B", bg: "#F59E0B15" },
  none: { label: "None", color: "#6B7280", bg: "#6B728015" },
};

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MyFines() {
  const [myFines, setMyFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    const fetchFines = async () => {
      try {
       const response = await apiFetch(
          `/api/fines/student/${user.student_id}`
        );

        const data = await response.json();
        setMyFines(data);
      } catch {
        alert("Failed to load your fines.");
      } finally {
        setLoading(false);
      }
    };

    fetchFines();
  }, []);

  const unpaid = myFines.filter((f) => f.payment_status !== "paid");
  const totalOwed = unpaid.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading fines...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          My Fines
        </h2>
        <p className="text-muted-foreground text-sm">
          View your fine records and payment status
        </p>
      </div>

      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden"
        style={{
          background:
            totalOwed > 0
              ? "linear-gradient(135deg, #7F1D1D, #DC2626)"
              : "linear-gradient(135deg, #064E3B, #10B981)",
        }}
      >
        <div
          className="absolute right-0 top-0 bottom-0 w-32 opacity-10"
          style={{ background: "radial-gradient(circle, white, transparent)" }}
        />

        <div className="relative z-10">
          <p className="text-white/65 text-sm mb-1">
            {totalOwed > 0 ? "Outstanding Balance" : "No Outstanding Fines"}
          </p>

          <p className="text-4xl font-heading font-bold">₱{totalOwed}</p>

          <p className="text-white/65 text-sm mt-2">
            {totalOwed > 0
              ? `${unpaid.length} unpaid fine record${
                  unpaid.length > 1 ? "s" : ""
                } · Please settle with the admin`
              : "You're all clear! Keep attending events on time."}
          </p>
        </div>
      </div>

      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "#FEF9EC", border: "1px solid #F59E0B30" }}
      >
        <AlertTriangle size={15} style={{ color: "#F59E0B", flexShrink: 0 }} />
        <p className="text-xs text-yellow-800">
          <strong>Fine Policy:</strong> ₱{FINE_PER_VIOLATION} per missed
          time-in · ₱{FINE_PER_VIOLATION} per missed time-out. Fines are
          automatically computed from QR scan records.
        </p>
      </div>

      <div className="space-y-3">
        <h3 className="font-heading font-bold text-foreground">Fine Records</h3>

        {myFines.length === 0 ? (
          <div
            className="rounded-2xl p-8 border text-center"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <CheckCircle size={36} className="mx-auto mb-3" style={{ color: "#10B981" }} />
            <p className="font-heading font-bold text-foreground">
              No fine records
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              You currently have no missing scan penalties.
            </p>
          </div>
        ) : (
          myFines.map((f) => {
            const status = statusConfig[f.payment_status] || statusConfig.unpaid;

            return (
              <div
                key={f.attendance_id}
                className="rounded-2xl p-5 border"
                style={{
                  background: "var(--card)",
                  borderColor: "var(--border)",
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h1 className="font-heading font-bold text-foreground">
                        {formatDate(f.attendance_date)}
                      </h1>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: status.bg,
                          color: status.color,
                        }}
                      >
                        {status.label}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3">
                      Attendance ID: {f.attendance_id} 
                    </p>

                    <div className="space-y-1.5">
                      {f.missed_in ? (
                        <div
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "#EF4444" }}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ background: "#EF4444" }}
                          >
                            ✗
                          </span>
                          Missing Time-In
                          <span className="font-bold ml-auto">
                            +₱{FINE_PER_VIOLATION}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "#10B981" }}
                        >
                          <CheckCircle size={14} />
                          Time-In Recorded
                        </div>
                      )}

                      {f.missed_out ? (
                        <div
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "#EF4444" }}
                        >
                          <span
                            className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs"
                            style={{ background: "#EF4444" }}
                          >
                            ✗
                          </span>
                          Missing Time-Out
                          <span className="font-bold ml-auto">
                            +₱{FINE_PER_VIOLATION}
                          </span>
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-2 text-sm"
                          style={{ color: "#10B981" }}
                        >
                          <CheckCircle size={14} />
                          Time-Out Recorded
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p
                      className="text-2xl font-heading font-bold"
                      style={{
                        color:
                          f.payment_status === "paid" ? "#10B981" : "#EF4444",
                      }}
                    >
                      ₱{f.amount}
                    </p>

                    {f.payment_status === "paid" ? (
                      <span className="text-xs" style={{ color: "#10B981" }}>
                        ✓ Settled
                      </span>
                    ) : (
                      <span
                        className="flex items-center gap-1 text-xs justify-end"
                        style={{ color: "#EF4444" }}
                      >
                        <Clock size={11} />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalOwed > 0 && (
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