import { apiFetch } from "./api";
import { longDate, shortDate, todayKey } from "./activityDates";

// A date the officers chose as a sportfest day (Sportfest Days page).
export type SportfestDay = {
  day_id: number;
  date_key: string; // "YYYY-MM-DD"
  title: string | null;
  status: "open" | "closed";
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

// Same rule as the server: fines count once the day is closed or has passed.
export function dayFinesCount(day: SportfestDay) {
  return day.status === "closed" || dayWhen(day) === "past";
}

export function dayCanScan(day: SportfestDay) {
  return dayWhen(day) === "today" && day.status === "open";
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
