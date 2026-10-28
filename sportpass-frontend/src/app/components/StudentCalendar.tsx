import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, CheckCircle, XCircle, Lock } from "lucide-react";
import type { Screen } from "./Layout";
import { apiFetch } from "../lib/api";
import { dateKey, longDate, timeLabel, todayKey } from "../lib/activityDates";
import {
  clockLabel,
  closingPassed,
  dayNumber,
  dayWhen,
  loadDays,
  type SportfestDay,
} from "../lib/sportfestDays";
import { PageError, PageLoading } from "./PageStatus";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const keyOf = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

interface Activity {
  activity_id: number;
  sport_name: string;
  activity_name: string;
  activity_date: string;
  activity_time: string | null;
  activity_location: string | null;
}

interface MyDay {
  day_id: number;
  time_in: string | null;
  time_out: string | null;
  fine: number;
  fine_final: boolean | number;
  payment_status: string;
  balance?: number;
}

const fmtTime = (v: string | null) =>
  v ? new Date(v).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : null;

// Students: the sportfest days on a calendar, with each day's activities,
// closing time and the student's own time-in / time-out.
export function StudentCalendar({ setScreen }: { setScreen?: (s: Screen) => void }) {
  const [days, setDays] = useState<SportfestDay[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [mine, setMine] = useState<MyDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = todayKey();
  const [view, setView] = useState(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  const [picked, setPicked] = useState<string | null>(null);
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await loadDays();
      setDays(list);
      const [aRes, hRes] = await Promise.all([
        apiFetch("/api/activities").catch(() => null),
        user.student_id ? apiFetch(`/api/attendance/history/${user.student_id}`).catch(() => null) : null,
      ]);
      const a = aRes && aRes.ok ? await aRes.json() : [];
      const h = hRes && hRes.ok ? await hRes.json() : [];
      setActivities(Array.isArray(a) ? a : []);
      setMine(Array.isArray(h) ? h : []);
      // Start on today's or the next sportfest day.
      const next = [...list].sort((x, y) => x.date_key.localeCompare(y.date_key)).find((d) => d.date_key >= today);
      const start = next || list[list.length - 1];
      if (start) {
        setPicked(start.date_key);
        const [y, m] = start.date_key.split("-").map(Number);
        setView({ y, m: m - 1 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The calendar couldn't be loaded.");
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

  if (loading) return <PageLoading label="Loading calendar…" />;
  if (error) return <PageError message={error} onRetry={load} />;

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

  const day = picked ? byKey[picked] : undefined;
  const dayActivities = picked ? activities.filter((a) => dateKey(a.activity_date) === picked) : [];
  const myDay = day ? mine.find((m) => m.day_id === day.day_id) : undefined;
  const upcoming = [...days].filter((d) => d.date_key >= today).sort((a, b) => a.date_key.localeCompare(b.date_key));

  const dayState = (d: SportfestDay) =>
    d.status === "closed" || closingPassed(d)
      ? { label: "Closed", color: "#6B7280" }
      : dayWhen(d) === "today"
      ? { label: "Today · open", color: "#059669" }
      : dayWhen(d) === "upcoming"
      ? { label: "Upcoming", color: "#2563EB" }
      : { label: "Done", color: "#6B7280" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">Sportfest Calendar</h2>
        <p className="text-muted-foreground text-sm">
          The sportfest days set by the officers. Show your QR code for time-in and time-out on each one.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="xl:col-span-2 rounded-2xl border p-4 sm:p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className="p-2 rounded-lg hover:bg-muted"><ChevronLeft size={16} /></button>
            <h3 className="font-heading font-bold text-foreground flex-1 text-center">{MONTHS[view.m]} {view.y}</h3>
            <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className="p-2 rounded-lg hover:bg-muted"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground mb-1">
            {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((key, i) => {
              if (!key) return <div key={`blank-${i}`} />;
              const d = byKey[key];
              const isToday = key === today;
              const active = key === picked;
              const closed = d && (d.status === "closed" || closingPassed(d));
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPicked(key)}
                  className="min-h-[52px] sm:min-h-[68px] min-w-0 overflow-hidden rounded-lg sm:rounded-xl border p-1 sm:p-1.5 text-left flex flex-col transition-all"
                  style={{
                    borderColor: active ? "var(--primary)" : "var(--border)",
                    borderWidth: active ? 2 : 1,
                    background: d ? (closed ? "#6B728012" : "color-mix(in srgb, var(--primary) 12%, transparent)") : "transparent",
                    opacity: !d && key < today ? 0.45 : 1,
                  }}
                >
                  <span
                    className={`text-xs font-semibold ${isToday ? "text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-foreground"}`}
                    style={isToday ? { background: "var(--primary)" } : undefined}
                  >
                    {Number(key.slice(8))}
                  </span>
                  {d && (
                    <span className="mt-auto text-[11px] font-semibold leading-tight" style={{ color: closed ? "#6B7280" : "var(--primary)" }}>
                      <span className="hidden sm:inline">Day </span>{dayNumber(d, days)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "color-mix(in srgb, var(--primary) 25%, transparent)" }} /> Sportfest day</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#6B728030" }} /> Closed / done</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: "var(--primary)" }} /> Today</span>
          </div>
        </div>

        {/* Selected day */}
        <div className="rounded-2xl border p-5 space-y-4 h-fit" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {!picked ? (
            <p className="text-sm text-muted-foreground">Tap a date to see its details.</p>
          ) : !day ? (
            <>
              <p className="text-sm font-semibold text-foreground">{longDate(picked)}</p>
              <p className="text-sm text-muted-foreground">Not a sportfest day.</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} style={{ color: "var(--primary)" }} />
                <h3 className="font-heading font-bold text-foreground">Day {dayNumber(day, days)}{day.title ? ` · ${day.title}` : ""}</h3>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dayState(day).color + "18", color: dayState(day).color }}>
                  {dayState(day).label}
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground">{longDate(day.date_key)}</p>
              {day.closes_at && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lock size={13} /> Attendance closes at {clockLabel(day.closes_at)}
                </p>
              )}

              {(dayWhen(day) !== "upcoming") && (
                <div className="rounded-xl p-3 space-y-1.5" style={{ background: "var(--muted)" }}>
                  <p className="text-xs font-semibold text-muted-foreground">My attendance</p>
                  {[
                    { label: "Time-in", value: fmtTime(myDay?.time_in ?? null) },
                    { label: "Time-out", value: fmtTime(myDay?.time_out ?? null) },
                  ].map((x) => (
                    <p key={x.label} className="flex items-center gap-2 text-sm" style={{ color: x.value ? "#10B981" : "#EF4444" }}>
                      {x.value ? <CheckCircle size={14} /> : <XCircle size={14} />}
                      {x.label}: {x.value || "Not recorded"}
                    </p>
                  ))}
                  {myDay && Number(myDay.fine) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Fine: ₱{Number(myDay.fine)}
                      {Number(myDay.fine_final) ? ` · ${myDay.payment_status}` : " · not final yet"}
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Activities this day</p>
                {dayActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities posted yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {dayActivities.map((a) => (
                      <li key={a.activity_id} className="rounded-xl p-3 border" style={{ borderColor: "var(--border)" }}>
                        <p className="text-sm font-semibold text-foreground">{a.sport_name} · {a.activity_name}</p>
                        <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                          {a.activity_time && <span className="flex items-center gap-1"><Clock size={11} /> {timeLabel(a.activity_time)}</span>}
                          {a.activity_location && <span className="flex items-center gap-1"><MapPin size={11} /> {a.activity_location}</span>}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {dayWhen(day) === "today" && setScreen && (
                <button type="button" onClick={() => setScreen("qr-code")} className="w-full py-2.5 rounded-xl text-white text-sm font-bold" style={{ background: "var(--primary)" }}>
                  Show My QR Code
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="rounded-2xl border p-5" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <h3 className="font-heading font-bold text-foreground mb-3">Upcoming sportfest days</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming sportfest days yet. They'll appear here when the officers announce them.</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {upcoming.map((d) => (
              <li key={d.day_id}>
                <button
                  type="button"
                  onClick={() => {
                    setPicked(d.date_key);
                    const [y, m] = d.date_key.split("-").map(Number);
                    setView({ y, m: m - 1 });
                  }}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-muted/40 rounded-lg px-2"
                >
                  <span className="text-sm font-semibold text-foreground flex-1">
                    Day {dayNumber(d, days)} · {longDate(d.date_key)}{d.title ? ` · ${d.title}` : ""}
                  </span>
                  {d.closes_at && <span className="text-xs text-muted-foreground">until {clockLabel(d.closes_at)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
