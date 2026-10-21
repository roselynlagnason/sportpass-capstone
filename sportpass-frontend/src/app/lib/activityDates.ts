// Activity dates arrive from MySQL as timestamps; these helpers read them
// as calendar dates in local (Philippine) time.

export type DatedActivity = {
  activity_id: number;
  activity_date: string;
  activity_time?: string | null;
  status?: string | null;
};

export function dateKey(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey() {
  return dateKey(new Date().toISOString());
}

function fromKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function longDate(value: unknown) {
  const key = dateKey(value);
  if (!key) return "No date set";
  return fromKey(key).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function shortDate(value: unknown) {
  const key = dateKey(value);
  if (!key) return "No date";
  return fromKey(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function timeLabel(value: unknown) {
  if (!value) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value));
  if (!m) return String(value);
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// "today" | "upcoming" | "past"
export function when(a: DatedActivity) {
  const k = dateKey(a.activity_date);
  const t = todayKey();
  if (k === t) return "today";
  return k > t ? "upcoming" : "past";
}

// Same rule as the server: fines count once the activity is completed
// or its date has passed.
export function finesCount(a: DatedActivity) {
  return a.status === "completed" || when(a) === "past";
}

export function sortByDate<T extends DatedActivity>(list: T[]) {
  return [...list].sort((x, y) =>
    `${dateKey(x.activity_date)} ${x.activity_time || ""}`.localeCompare(
      `${dateKey(y.activity_date)} ${y.activity_time || ""}`
    )
  );
}

// Today's activity if there is one, otherwise the most recent past one,
// otherwise the next upcoming one.
export function defaultActivity<T extends DatedActivity>(list: T[]) {
  const sorted = sortByDate(list);
  const t = todayKey();
  return (
    sorted.find((a) => dateKey(a.activity_date) === t) ||
    [...sorted].reverse().find((a) => dateKey(a.activity_date) < t) ||
    sorted[0] ||
    null
  );
}
