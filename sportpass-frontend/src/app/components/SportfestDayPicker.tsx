import { Calendar, Users } from "lucide-react";
import { shortDate } from "../lib/activityDates";
import {
  dayFinesCount,
  dayLabel,
  dayLongLabel,
  dayNumber,
  dayWhen,
  type SportfestDay,
} from "../lib/sportfestDays";

// Lets the admin choose which sportfest day the page shows.
export function SportfestDayPicker({
  days,
  value,
  onChange,
  mode,
  onManageDays,
}: {
  days: SportfestDay[];
  value: number | null;
  onChange: (dayId: number) => void;
  mode: "attendance" | "fines";
  onManageDays?: () => void;
}) {
  const sorted = [...days].sort((a, b) => a.date_key.localeCompare(b.date_key));
  const selected = days.find((d) => d.day_id === value);

  if (days.length === 0) {
    return (
      <div
        className="rounded-2xl p-5 border flex flex-col sm:flex-row sm:items-center gap-3"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <p className="text-sm text-muted-foreground flex-1">
          No sportfest days yet. Add the dates the officers have set on the Sportfest Days page.
        </p>
        {onManageDays && (
          <button
            onClick={onManageDays}
            className="px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            Add Sportfest Days
          </button>
        )}
      </div>
    );
  }

  let note: { text: string; color: string } | null = null;
  if (selected) {
    const w = dayWhen(selected);
    if (mode === "attendance") {
      note =
        selected.status === "closed"
          ? { text: "This day is closed, so scanning is off.", color: "#6B7280" }
          : w === "today"
          ? { text: "Scanning is open today.", color: "#059669" }
          : w === "upcoming"
          ? { text: `Scanning opens on ${shortDate(selected.date_key)}.`, color: "#2563EB" }
          : { text: "This day has passed, so scanning is closed.", color: "#6B7280" };
    } else {
      note = dayFinesCount(selected)
        ? { text: "Fines for this day are final.", color: "#059669" }
        : dayWhen(selected) === "upcoming"
        ? { text: `No fines yet. This day starts on ${shortDate(selected.date_key)}.`, color: "#2563EB" }
        : {
            text: `Fines are computed from today's scans and become final when this day is closed or after ${shortDate(selected.date_key)}.`,
            color: "#D97706",
          };
    }
  }

  return (
    <div
      className="rounded-2xl p-5 border flex flex-col lg:flex-row lg:items-center gap-4"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="lg:w-96 flex-shrink-0">
        <label htmlFor={`day-picker-${mode}`} className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
          Sportfest day
        </label>
        <select
          id={`day-picker-${mode}`}
          value={value ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none font-semibold"
          style={{ background: "var(--input-background)", borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          {sorted.map((d) => (
            <option key={d.day_id} value={d.day_id}>
              {dayLabel(d, days)}
              {dayWhen(d) === "today" ? " (today)" : ""}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-heading font-bold text-foreground">
              <Calendar size={16} style={{ color: "var(--primary)" }} />
              Day {dayNumber(selected, days)} · {dayLongLabel(selected)}
            </span>
            {selected.title && (
              <span className="text-sm text-muted-foreground">{selected.title}</span>
            )}
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users size={14} />
              {selected.present} present
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
              style={{
                background: selected.status === "closed" ? "#6B728018" : "#10B98118",
                color: selected.status === "closed" ? "#6B7280" : "#059669",
              }}
            >
              {selected.status}
            </span>
          </div>
          {note && (
            <p className="text-sm mt-1.5" style={{ color: note.color }}>
              {note.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
