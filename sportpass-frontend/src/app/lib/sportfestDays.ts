import { apiFetch } from "./api";
import { longDate, shortDate, todayKey } from "./activityDates";

// A date the officers chose as a sportfest day (Sportfest Days page).
export type SportfestDay = {
  day_id: number;
  date_key: string; // "YYYY-MM-DD"
  title: string | null;
  status: "open" | "closed";
  closes_at?: string | null; // "17:00": the day closes by itself at this time
  is_today: number | boolean;
  is_over: number | boolean;
  present: number;
  records: number;
  activities: number;
};

const DAYS_CACHE_KEY = "sportpass_days_cache";

// Loads the sportfest days. The last list is kept on the device so the
// attendance scanner still opens when there's no internet.
export async function loadDays(): Promise<SportfestDay[]> {
  let response: Response;
  try {
    response = await apiFetch("/api/attendance/days");
  } catch (err) {
    const cached = cachedDays();
    if (cached) return cached;
    throw err;
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || "Failed to load sportfest days.");
  const list = Array.isArray(data) ? data : [];
  try {
    localStorage.setItem(DAYS_CACHE_KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable */
  }
  return list;
}

export function cachedDays(): SportfestDay[] | null {
  try {
    const raw = localStorage.getItem(DAYS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as SportfestDay[]) : null;
  } catch {
    return null;
  }
}

export function dayWhen(day: SportfestDay): "today" | "upcoming" | "past" {
  const t = todayKey();
  if (day.date_key === t) return "today";
  return day.date_key > t ? "upcoming" : "past";
}

// "17:00" -> "5:00 PM"
export function clockLabel(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// Today's closing time has passed (the day closed by itself).
export function closingPassed(day: SportfestDay) {
  if (dayWhen(day) !== "today" || !day.closes_at) return false;
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  return hhmm >= day.closes_at.slice(0, 5);
}

// Same rule as the server: fines count once the day is closed, its closing
// time has passed, or its date has passed.
export function dayFinesCount(day: SportfestDay) {
  return day.status === "closed" || dayWhen(day) === "past" || closingPassed(day);
}

export function dayCanScan(day: SportfestDay) {
  return dayWhen(day) === "today" && day.status === "open" && !closingPassed(day);
}

// "Day 2 of 5" style number, by date order.
export function dayNumber(day: SportfestDay, days: SportfestDay[]) {
  const sorted = [...days].sort((a, b) => a.date_key.localeCompare(b.date_key));
  return sorted.findIndex((d) => d.day_id === day.day_id) + 1;
}

export function dayLabel(day: SportfestDay, days: SportfestDay[]) {
  const n = dayNumber(day, days);
  return `Day ${n} · ${shortDate(day.date_key)}${day.title ? ` · ${day.title}` : ""}`;
}

export function dayLongLabel(day: SportfestDay) {
  return longDate(day.date_key);
}

// Today's sportfest day if there is one, otherwise the most recent past
// one, otherwise the next one coming up.
export function defaultDay(days: SportfestDay[]) {
  const sorted = [...days].sort((a, b) => a.date_key.localeCompare(b.date_key));
  const t = todayKey();
  return (
    sorted.find((d) => d.date_key === t) ||
    [...sorted].reverse().find((d) => d.date_key < t) ||
    sorted[0] ||
    null
  );
}
