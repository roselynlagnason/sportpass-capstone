import { useState } from "react";
import { KeyRound } from "lucide-react";
import { apiFetch } from "../lib/api";

const inputStyle = {
  background: "var(--input-background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

// Lets any logged-in user change their own password.
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (next.length < 8) {
      setMessage({ ok: false, text: "The new password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMessage({ ok: false, text: "The new passwords don't match." });
      return;
    }

    try {
      setSaving(true);
      const response = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage({ ok: false, text: data.message || "Failed to change password." });
        return;
      }

      setCurrent("");
      setNext("");
      setConfirm("");
      setMessage({ ok: true, text: "Password changed. Use the new password next time you log in." });
    } catch {
      setMessage({ ok: false, text: "Cannot connect to server." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl p-5 border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} style={{ color: "var(--primary)" }} />
        <h3 className="font-heading font-bold text-foreground">Change Password</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        If an administrator reset your password, set your own here.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="pw-current" className="text-sm font-semibold text-foreground mb-1.5 block">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="pw-new" className="text-sm font-semibold text-foreground mb-1.5 block">New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="Min. 8 characters" className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="pw-confirm" className="text-sm font-semibold text-foreground mb-1.5 block">Confirm new password</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={saving || !current || !next || !confirm}
          className="px-5 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-60"
          style={{ background: "var(--primary)" }}
        >
          {saving ? "Saving..." : "Change Password"}
        </button>
        {message && (
          <p className="text-sm" style={{ color: message.ok ? "#059669" : "#EF4444" }}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
