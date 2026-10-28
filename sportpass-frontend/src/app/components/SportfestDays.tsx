import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Lock, Unlock, ClipboardList } from "lucide-react";
import { apiFetch } from "../lib/api";
import { longDate, shortDate, todayKey } from "../lib/activityDates";
import {
  dayNumber,
  dayWhen,
  loadDays,
  closingPassed,
  clockLabel,
  type SportfestDay,
} from "../lib/sportfestDays";
import { alertDialog } from "../lib/dialog";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

const inputStyle = {
  background: "var(--input-background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

// Officers decide which dates are sportfest days. Attendance (one time-in
// and one time-out per student) is taken on these days only.
export function SportfestDays({ setScreen }: { setScreen?: (screen: any) => void }) {
  const [days, setDays] = useState<SportfestDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const today = todayKey();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });

  // Right-hand panel: adding a new day, or viewing an existing one.
  const [adding, setAdding] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [notify, setNotify] = useState(true);
  const [closesAt, setClosesAt] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [panelMessage, setPanelMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    try {
      setError("");
      setDays(await loadDays());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sportfest days.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const byKey = useMemo(() => {
    const map: Record<string, SportfestDay> = {};
    days.forEach((d) => (map[d.date_key] = d));
    return map;
  }, [days]);

  const selected = days.find((d) => d.day_id === selectedId) || null;
  const sorted = [...days].sort((a, b) => a.date_key.localeCompare(b.date_key));

  const pickDate = (key: string) => {
    setPanelMessage(null);
    const existing = byKey[key];
    if (existing) {
      setAdding(null);
      setSelectedId(existing.day_id);
      setTitle(existing.title || "");
      setClosesAt(existing.closes_at || "");
      return;
    }
    setSelectedId(null);
    if (key < today) {
      setAdding(null);
      setPanelMessage({ ok: false, text: "Past dates can't become sportfest days. Pick today or a later date." });
      return;
    }
    setAdding(key);
    setTitle("");
    setNotify(true);
    setClosesAt("17:00");
  };

  const call = async (path: string, init: RequestInit, okText: string) => {
    try {
      setBusy(true);
      setPanelMessage(null);
      const response = await apiFetch(path, init);
      const data = await response.json();
      if (!response.ok) {
        setPanelMessage({ ok: false, text: data.message || "Something went wrong." });
        return null;
      }
      setPanelMessage({ ok: true, text: okText });
      await load();
      return data;
    } catch {
      setPanelMessage({ ok: false, text: "Cannot connect to server." });
      return null;
    } finally {
      setBusy(false);
    }
  };

  const addDay = async () => {
    if (!adding) return;
    const data = await call(
      "/api/attendance/days",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sportfest_date: adding, title: title.trim(), notify, closes_at: closesAt || null }),
      },
      notify ? "Sportfest day added. Students have been notified." : "Sportfest day added."
    );
    if (data) {
      setAdding(null);
      setSelectedId(data.day_id);
    }
  };

  const saveTitle = () =>
    selected &&
    call(
      `/api/attendance/days/${selected.day_id}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) },
      "Title saved."
    );

  const saveClosingTime = () =>
    selected &&
    call(
      `/api/attendance/days/${selected.day_id}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ closes_at: closesAt || null }) },
      closesAt ? `This day now closes automatically at ${clockLabel(closesAt)}.` : "Closing time removed. Close the day by hand."
    );

  const setStatus = (status: "open" | "closed") =>
    selected &&
    call(
      `/api/attendance/days/${selected.day_id}`,
      { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) },
      status === "closed" ? "Day closed. Its fines are now final." : "Day reopened."
    );

  // Cancelling a day: a window to confirm it and announce it to students.
  const [cancelling, setCancelling] = useState<{ notify: boolean; title: string; message: string } | null>(null);

  const removeDay = () => {
    if (!selected) return;
    const when = longDate(selected.date_key);
    setCancelling({
      notify: true,
      title: `Sportfest day cancelled: ${when}`,
      message: `${selected.title ? `${selected.title} (${when})` : when} has been cancelled. There is no attendance and no fines for this day. Please watch for further announcements.`,
    });
  };

  const confirmRemove = async () => {
    if (!selected || !cancelling) return;
    const data = await call(
      `/api/attendance/days/${selected.day_id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notify: cancelling.notify,
          announce_title: cancelling.title,
          announce_message: cancelling.message,
        }),
      },
      cancelling.notify ? "Sportfest day removed. Students have been notified." : "Sportfest day removed."
    );
    if (data) {
      setCancelling(null);
      setSelectedId(null);
    }
  };

  // Calendar cells for the month in view.
  const first = new Date(view.y, view.m, 1);
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: first.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => keyOf(view.y, view.m, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const moveMonth = (delta: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading sportfest days...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">Sportfest Days</h2>
        <p className="text-muted-foreground text-sm">
          Click a date to make it a sportfest day. Attendance and fines are taken on these days only.
        </p>
      </div>

      {error && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "#FEF2F2", color: "#B91C1C" }}>{error}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-2 rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => moveMonth(-1)} aria-label="Previous month" className="p-2 rounded-lg hover:bg-muted"><ChevronLeft size={18} /></button>
            <h3 className="font-heading font-bold text-foreground flex-1 text-center">{MONTHS[view.m]} {view.y}</h3>
            <button onClick={() => moveMonth(1)} aria-label="Next month" className="p-2 rounded-lg hover:bg-muted"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-1">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((key, i) => {
              if (!key) return <div key={`blank-${i}`} />;
              const day = byKey[key];
              const isToday = key === today;
              const isPast = key < today;
              const isActive = (day && day.day_id === selectedId) || adding === key;
              return (
                <button
                  key={key}
                  onClick={() => pickDate(key)}
                  className="min-h-[52px] sm:min-h-[72px] min-w-0 overflow-hidden rounded-lg sm:rounded-xl border p-1 sm:p-1.5 text-left flex flex-col transition-all hover:shadow-sm"
                  style={{
                    borderColor: isActive ? "var(--primary)" : "var(--border)",
                    borderWidth: isActive ? 2 : 1,
                    background: day
                      ? (day.status === "closed" || closingPassed(day))
                        ? "#6B728012"
                        : "color-mix(in srgb, var(--primary) 12%, transparent)"
                      : "transparent",
                    opacity: isPast && !day ? 0.45 : 1,
                  }}
                >
                  <span
                    className={`text-xs font-semibold ${isToday ? "text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-foreground"}`}
                    style={isToday ? { background: "var(--primary)" } : undefined}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {day && (
                    <span className="mt-auto text-[11px] font-semibold leading-tight" style={{ color: (day.status === "closed" || closingPassed(day)) ? "#6B7280" : "var(--primary)" }}>
                      <span className="hidden sm:inline">Day </span>{dayNumber(day, days)}
                      {day.title && <span className="hidden sm:block font-normal text-muted-foreground truncate">{day.title}</span>}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "color-mix(in srgb, var(--primary) 25%, transparent)" }} /> Sportfest day (open)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#6B728030" }} /> Closed</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: "var(--primary)" }} /> Today</span>
          </div>
        </div>

        {/* Panel */}
        <div className="rounded-2xl border p-5 space-y-4 h-fit" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {adding ? (
            <>
              <div className="flex items-center gap-2">
                <Plus size={16} style={{ color: "var(--primary)" }} />
                <h3 className="font-heading font-bold text-foreground">Add Sportfest Day</h3>
              </div>
              <p className="text-sm font-semibold text-foreground">{longDate(adding)}</p>
              <div>
                <label htmlFor="day-title" className="text-sm font-semibold text-foreground mb-1.5 block">Title (optional)</label>
                <input id="day-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening Day, Basketball Finals" className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="day-closes" className="text-sm font-semibold text-foreground mb-1.5 block">Closing time</label>
                <input id="day-closes" type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
                <p className="text-xs text-muted-foreground mt-1">
                  {closesAt
                    ? `Scanning stops and fines become final at ${clockLabel(closesAt)}. Clear it to close the day by hand.`
                    : "No closing time: close the day by hand."}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                Notify students about this day
              </label>
              <div className="flex gap-2">
                <button onClick={() => setAdding(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Cancel</button>
                <button onClick={addDay} disabled={busy} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--primary)" }}>
                  {busy ? "Adding..." : "Add Day"}
                </button>
              </div>
            </>
          ) : selected ? (
            <>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} style={{ color: "var(--primary)" }} />
                <h3 className="font-heading font-bold text-foreground">Day {dayNumber(selected, days)}</h3>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ background: selected.status === "closed" ? "#6B728018" : "#10B98118", color: selected.status === "closed" ? "#6B7280" : "#059669" }}>
                  {selected.status}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{longDate(selected.date_key)}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ background: "var(--muted)" }}>
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="font-heading font-bold text-foreground text-lg">{selected.present}</p>
                </div>
                <div className="rounded-xl p-3" style={{ background: "var(--muted)" }}>
                  <p className="text-xs text-muted-foreground">Activities that day</p>
                  <p className="font-heading font-bold text-foreground text-lg">{selected.activities}</p>
                </div>
              </div>

              <div>
                <label htmlFor="day-title-edit" className="text-sm font-semibold text-foreground mb-1.5 block">Title</label>
                <div className="flex gap-2">
                  <input id="day-title-edit" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Opening Day" className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
                  <button onClick={saveTitle} disabled={busy} className="px-3 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Save</button>
                </div>
              </div>

              <div>
                <label htmlFor="day-closes-edit" className="text-sm font-semibold text-foreground mb-1.5 block">Closing time</label>
                <div className="flex gap-2">
                  <input id="day-closes-edit" type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
                  <button onClick={saveClosingTime} disabled={busy} className="px-3 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Save</button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {closingPassed(selected)
                  ? `This day closed automatically at ${clockLabel(selected.closes_at)}; its fines are final.`
                  : dayWhen(selected) === "today"
                  ? `Today: officers can scan students on the Attendance page${selected.closes_at ? ` until ${clockLabel(selected.closes_at)}` : ""}.`
                  : dayWhen(selected) === "upcoming"
                  ? "Scanning opens on this date."
                  : "This day has passed; its fines are final."}{" "}
                Closing a day makes its fines final right away.
              </p>

              <div className="flex flex-col gap-2">
                {setScreen && (
                  <button onClick={() => setScreen("attendance")} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: "var(--primary)" }}>
                    <ClipboardList size={15} /> Open Attendance
                  </button>
                )}
                {selected.status === "open" ? (
                  <button onClick={() => setStatus("closed")} disabled={busy} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                    <Lock size={15} /> Close Day
                  </button>
                ) : (
                  <button onClick={() => setStatus("open")} disabled={busy} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
                    <Unlock size={15} /> Reopen Day
                  </button>
                )}
                <button
                  onClick={removeDay}
                  disabled={busy || Number(selected.records) > 0}
                  title={Number(selected.records) > 0 ? "Students were already scanned on this day" : undefined}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold disabled:opacity-40"
                  style={{ borderColor: "var(--border)", color: "#DC2626" }}
                >
                  <Trash2 size={15} /> Remove Day
                </button>
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">No date selected</p>
              <p>Click a date on the calendar to add it as a sportfest day, or click a highlighted day to manage it.</p>
            </div>
          )}

          {panelMessage && (
            <p className="text-sm" style={{ color: panelMessage.ok ? "#059669" : "#EF4444" }}>{panelMessage.text}</p>
          )}
        </div>
      </div>

      {/* All days */}
      <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <h3 className="font-heading font-bold text-foreground">All Sportfest Days ({days.length})</h3>
        </div>
        {sorted.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">No sportfest days yet. Click a date on the calendar to add the first one.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground" style={{ background: "var(--muted)" }}>
                  <th className="px-5 py-3">Day</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Title</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Present</th>
                  <th className="px-5 py-3 text-right">Activities</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr
                    key={d.day_id}
                    onClick={() => {
                      const [y, m] = d.date_key.split("-").map(Number);
                      setView({ y, m: m - 1 });
                      pickDate(d.date_key);
                    }}
                    className="border-t cursor-pointer hover:bg-muted/50"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <td className="px-5 py-3 font-semibold text-foreground">Day {dayNumber(d, days)}</td>
                    <td className="px-5 py-3 text-foreground">
                      {shortDate(d.date_key)}
                      {d.date_key === today && <span className="ml-2 text-xs font-semibold" style={{ color: "var(--primary)" }}>today</span>}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{d.title || "—"}</td>
                    <td className="px-5 py-3 capitalize text-muted-foreground">{d.status}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{d.present}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-foreground">{d.activities}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelling && selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15, 23, 42, 0.55)" }}
          onMouseDown={(e) => e.target === e.currentTarget && setCancelling(null)}
        >
          <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto" style={{ background: "var(--card)" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#EF444418", color: "#EF4444" }}>
                <Trash2 size={18} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-foreground">Cancel this sportfest day?</h3>
                <p className="text-xs text-muted-foreground">{longDate(selected.date_key)} will be removed from the calendar.</p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <input type="checkbox" checked={cancelling.notify} onChange={(e) => setCancelling({ ...cancelling, notify: e.target.checked })} />
              Announce the cancellation to students
            </label>

            {cancelling.notify && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="cancel-title" className="text-sm font-semibold text-foreground mb-1.5 block">Announcement title</label>
                  <input id="cancel-title" maxLength={150} value={cancelling.title} onChange={(e) => setCancelling({ ...cancelling, title: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
                </div>
                <div>
                  <label htmlFor="cancel-message" className="text-sm font-semibold text-foreground mb-1.5 block">Message</label>
                  <textarea id="cancel-message" rows={4} maxLength={2000} value={cancelling.message} onChange={(e) => setCancelling({ ...cancelling, message: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-y" style={inputStyle} />
                </div>
              </div>
            )}

            {panelMessage && !panelMessage.ok && (
              <p className="text-sm mt-3" style={{ color: "#EF4444" }}>{panelMessage.text}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setCancelling(null)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted" style={{ borderColor: "var(--border)" }}>
                Keep Day
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                disabled={busy || (cancelling.notify && (!cancelling.title.trim() || !cancelling.message.trim()))}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: "#EF4444" }}
              >
                {busy ? "Removing…" : cancelling.notify ? "Remove & Notify" : "Remove Day"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
