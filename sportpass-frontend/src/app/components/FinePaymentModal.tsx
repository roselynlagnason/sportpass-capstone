import { useEffect, useState } from "react";
import { X, Wallet, History } from "lucide-react";
import { apiFetch } from "../lib/api";
import { alertDialog } from "../lib/dialog";

export interface FineForPayment {
  student_id: string;
  name: string;
  dayLabel: string;
  day_id?: number | null;
  fine_id?: number | null;
  fine: number;
  amount_paid: number;
  balance: number;
}

interface Payment {
  payment_id: number;
  amount: number | string;
  note: string | null;
  paid_at: string;
  recorded_by: string | null;
}

const peso = (n: unknown) =>
  `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Record a full or partial payment toward one fine, with a note,
// and see every payment made so far.
export function FinePaymentModal({
  fine,
  onClose,
  onSaved,
}: {
  fine: FineForPayment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(fine.balance));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState<Payment[] | null>(null);

  useEffect(() => {
    const q = fine.fine_id ? `fine_id=${fine.fine_id}` : `day_id=${fine.day_id}`;
    apiFetch(`/api/fines/payments/${encodeURIComponent(fine.student_id)}?${q}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setPayments(Array.isArray(rows) ? rows : []))
      .catch(() => setPayments([]));
  }, [fine]);

  const value = Number(amount);
  const after = Math.max(0, Math.round((fine.balance - (Number.isFinite(value) ? value : 0)) * 100) / 100);

  const save = async () => {
    setError("");
    if (!Number.isFinite(value) || value <= 0) return setError("Enter an amount greater than zero.");
    if (value > fine.balance) return setError(`The balance is only ${peso(fine.balance)}.`);
    setSaving(true);
    try {
      const response = await apiFetch("/api/fines/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: fine.student_id,
          day_id: fine.day_id ?? undefined,
          fine_id: fine.fine_id ?? undefined,
          amount: value,
          note,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.message || "The payment couldn't be recorded.");
        return;
      }
      onSaved();
      onClose();
      alertDialog({
        title: data.payment_status === "paid" ? "Fine fully paid" : "Partial payment recorded",
        message: `${fine.name}: ${data.message}`,
        tone: "success",
      });
    } catch {
      setError("Can't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
        style={{ background: "var(--card)" }}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#10B98118", color: "#10B981" }}>
            <Wallet size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-foreground">Record Payment</h3>
            <p className="text-xs text-muted-foreground truncate">
              {fine.name} · {fine.dayLabel}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4 text-center">
          {[
            { label: "Fine", value: fine.fine, color: "var(--foreground)" },
            { label: "Paid", value: fine.amount_paid, color: "#10B981" },
            { label: "Balance", value: fine.balance, color: "#EF4444" },
          ].map((x) => (
            <div key={x.label} className="rounded-xl p-2.5" style={{ background: "var(--muted)" }}>
              <p className="text-lg font-heading font-bold" style={{ color: x.color }}>{peso(x.value)}</p>
              <p className="text-[11px] text-muted-foreground font-semibold">{x.label}</p>
            </div>
          ))}
        </div>

        {fine.balance <= 0 ? (
          <p className="text-sm font-semibold text-center py-2" style={{ color: "#10B981" }}>
            This fine is fully paid.
          </p>
        ) : (
        <>
        <label htmlFor="pay-amount" className="text-sm font-semibold text-foreground mb-1.5 block">
          Amount received
        </label>
        <div className="flex gap-2">
          <input
            id="pay-amount"
            type="number"
            inputMode="decimal"
            min={1}
            max={fine.balance}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
          />
          <button
            type="button"
            onClick={() => setAmount(String(fine.balance))}
            className="px-3 rounded-xl border text-xs font-semibold hover:bg-muted"
            style={{ borderColor: "var(--border)" }}
          >
            Full balance
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {value > 0 && value < fine.balance
            ? `Partial payment. ${peso(after)} will still be owed.`
            : value === fine.balance
            ? "This settles the fine."
            : " "}
        </p>

        <label htmlFor="pay-note" className="text-sm font-semibold text-foreground mt-3 mb-1.5 block">
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="pay-note"
          rows={2}
          maxLength={255}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Paid ₱30 at the booth, rest on Friday"
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
          style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
        />

        {error && (
          <p role="alert" className="text-sm mt-2" style={{ color: "#DC2626" }}>{error}</p>
        )}
        </>
        )}

        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
            <History size={13} /> Payments so far
          </p>
          {payments === null ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : payments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No payments yet.</p>
          ) : (
            <ul className="space-y-1.5 max-h-36 overflow-y-auto">
              {payments.map((p) => (
                <li key={p.payment_id} className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--muted)" }}>
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-foreground">{peso(p.amount)}</span>
                    <span className="text-muted-foreground">
                      {new Date(p.paid_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  {p.note && <p className="text-muted-foreground mt-0.5">{p.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted"
            style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {fine.balance <= 0 ? "Close" : "Cancel"}
          </button>
          {fine.balance > 0 && (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60"
            style={{ background: "#10B981" }}
          >
            {saving ? "Saving…" : "Record Payment"}
          </button>
          )}
        </div>
      </div>
    </div>
  );
}
