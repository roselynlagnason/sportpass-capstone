import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Database,
  Save,
  CheckCircle,
  Trophy,
  QrCode,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { ChangePassword } from "./ChangePassword";
import {
  DEFAULT_SETTINGS,
  applyPrimaryColor,
  getPrimaryColor,
  getSettings,
  loadSettings,
  setCachedSettings,
  type SystemSettings,
} from "../lib/settings";

function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
      style={{
        background: value ? "var(--primary)" : "#CBD5E1",
      }}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function Settings() {
  const [form, setForm] = useState<SystemSettings>({ ...DEFAULT_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [primaryColor, setPrimaryColor] = useState(getPrimaryColor());

  useEffect(() => {
    (async () => {
      const fromDb = await loadSettings();
      setForm({ ...getSettings() });
      setDbConnected(fromDb);
      setLoading(false);
    })();
  }, []);

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    const blank = (Object.keys(DEFAULT_SETTINGS) as (keyof SystemSettings)[]).find(
      (k) => typeof DEFAULT_SETTINGS[k] === "number" && !Number.isFinite(form[k] as number)
    );
    if (blank) {
      setError("Fill in every number before saving.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const response = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to save settings.");
        return;
      }

      setCachedSettings(data.settings);
      setForm({ ...data.settings });
      setDbConnected(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-heading font-bold text-foreground text-xl">
            Settings
          </h2>
          <p className="text-muted-foreground text-sm">
            Configure SPORTPASS system preferences. Changes apply to everyone.
          </p>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all disabled:opacity-60"
          style={{ background: saved ? "#10B981" : "var(--primary)" }}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "#FEF2F2", color: "#B91C1C" }}>
          {error}
        </div>
      )}

      <Section title="Sportfest Information" icon={<Database size={16} />} color="#2563EB">
        <div className="space-y-4">
          <InputField label="Event Name" value={form.sportfest_name} onChange={(v) => set("sportfest_name", v)} />
          <InputField label="Institution" value={form.school_name} onChange={(v) => set("school_name", v)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DateField label="Start Date" value={form.start_date} onChange={(v) => set("start_date", v)} />
            <DateField label="End Date" value={form.end_date} onChange={(v) => set("end_date", v)} />
          </div>
        </div>
      </Section>

      <Section title="Scoring & Fine Rules" icon={<SettingsIcon size={16} />} color="#10B981">
        <div className="space-y-4">
          <NumberField
            label="Default Participation Points"
            hint="Pre-filled when creating an activity"
            value={form.default_participation_points}
            onChange={(v) => set("default_participation_points", v)}
          />
          <NumberField
            label="Default Accomplishment Points"
            hint="Pre-filled when creating an activity"
            value={form.default_accomplishment_points}
            onChange={(v) => set("default_accomplishment_points", v)}
          />
          <NumberField
            label="Fine per Missed Scan"
            hint="A missed time-in or time-out. An absence counts as two missed scans."
            value={form.fine_per_missed_scan}
            onChange={(v) => set("fine_per_missed_scan", v)}
            prefix="₱"
          />
          <p className="text-xs text-muted-foreground">
            Fines count once an activity is marked completed or its date has passed.
            Changing the fine amount updates all unpaid fines that weren't set by hand.
          </p>
        </div>
      </Section>

      <Section title="Rewards" icon={<Trophy size={16} />} color="#F59E0B">
        <div className="space-y-4">
          <NumberField
            label="Placement Awards"
            hint="Top ranks that get a title: 1 = Champion only, 3 = Champion and two Runners-Up, 0 = none"
            value={form.placement_awards}
            onChange={(v) => set("placement_awards", v)}
          />
          <NumberField
            label="High Performer Points"
            hint="Students with at least this many points qualify as High Performers"
            value={form.high_performer_points}
            onChange={(v) => set("high_performer_points", v)}
          />
          <p className="text-xs text-muted-foreground">
            Any student with points above zero qualifies as an Active Participant.
          </p>
        </div>
      </Section>

      <Section title="QR Codes & Attendance" icon={<QrCode size={16} />} color="#8B5CF6">
        <div className="space-y-4">
          <NumberField
            label="Activity QR Lifetime"
            hint="Seconds before the admin screen shows a new activity code (30–86400)"
            value={form.activity_qr_ttl_seconds}
            onChange={(v) => set("activity_qr_ttl_seconds", v)}
            suffix="sec"
          />
          <NumberField
            label="Student QR Lifetime"
            hint="Seconds before a student's attendance code refreshes (30–3600)"
            value={form.student_qr_ttl_seconds}
            onChange={(v) => set("student_qr_ttl_seconds", v)}
            suffix="sec"
          />
          <NumberField
            label="Minimum Time Before Time-out"
            hint="Stops an accidental second scan from ending attendance"
            value={form.min_minutes_before_time_out}
            onChange={(v) => set("min_minutes_before_time_out", v)}
            suffix="min"
          />
        </div>
      </Section>

      <Section title="Notifications" icon={<Bell size={16} />} color="#F59E0B">
        <SettingToggle
          title="Notify Students About Activity Changes"
          desc="Automatically send a notification when an activity is created, updated or completed"
          value={form.notify_on_activity_change}
          onChange={(v) => set("notify_on_activity_change", v)}
        />
      </Section>

      <Section title="Access & Roles" icon={<Shield size={16} />} color="#8B5CF6">
        <div className="space-y-3">
          {[
            {
              role: "Administrator",
              color: "#2563EB",
              permissions: [
                "Manage students",
                "Manage activities",
                "Scan attendance",
                "Monitor fines",
                "Generate reports",
                "Send notifications",
                "Change settings",
              ],
            },
            {
              role: "Student",
              color: "#F59E0B",
              permissions: [
                "View QR code",
                "Scan activity QR",
                "View passport",
                "View own performance",
                "View attendance history",
                "View rankings",
                "Receive notifications",
              ],
            },
          ].map((r) => (
            <div
              key={r.role}
              className="rounded-xl p-4 border"
              style={{ borderColor: "var(--border)" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                <p className="font-semibold text-foreground text-sm">{r.role}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {r.permissions.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: r.color + "15", color: r.color }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Appearance" icon={<Palette size={16} />} color="#6B7280">
        <div>
          <label className="text-sm font-semibold text-foreground mb-1 block">
            Primary Color
          </label>
          <p className="text-xs text-muted-foreground mb-2">
            Saved in this browser only. Applies right away.
          </p>

          <div className="flex gap-2">
            {["#2563EB", "#7C3AED", "#059669", "#DC2626", "#D97706"].map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Use color ${c}`}
                onClick={() => {
                  setPrimaryColor(c);
                  applyPrimaryColor(c);
                }}
                className="w-8 h-8 rounded-full border-2 transition-all"
                style={{
                  background: c,
                  borderColor: primaryColor === c ? "var(--foreground)" : "transparent",
                }}
              />
            ))}
          </div>
        </div>
      </Section>

      <ChangePassword />

      <Section title="System Status" icon={<CheckCircle size={16} />} color="#10B981">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              label: "Database",
              value: dbConnected ? "Connected" : "Not reachable",
              color: dbConnected ? "#10B981" : "#EF4444",
            },
            { label: "Backend API", value: "Online", color: "#10B981" },
            { label: "SPORTPASS", value: "v1.1", color: "#2563EB" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-4 text-center"
              style={{ background: "var(--muted)" }}
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="font-heading font-bold mt-1" style={{ color: s.color }}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  color,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center gap-3 px-5 py-4 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: color + "18", color }}
        >
          {icon}
        </div>
        <h3 className="font-heading font-bold text-foreground">{title}</h3>
      </div>

      <div className="p-5">{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{
          background: "var(--input-background)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      />
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground mb-1.5 block">
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
        style={{
          background: "var(--input-background)",
          borderColor: "var(--border)",
          color: "var(--foreground)",
        }}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  const id = "setting-" + label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</label>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {prefix && (
          <span className="text-sm font-bold text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="number"
          min={0}
          step={1}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="w-24 px-3 py-2 rounded-xl border text-sm outline-none text-right"
          style={{
            background: "var(--input-background)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
        {suffix && (
          <span className="text-xs text-muted-foreground w-7">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function SettingToggle({
  title,
  desc,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 p-3 rounded-xl"
      style={{ background: "var(--muted)" }}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>

      <Toggle value={value} onChange={onChange} />
    </div>
  );
}