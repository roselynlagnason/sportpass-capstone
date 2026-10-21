/*
 * System settings, editable by admins on the Settings page and stored in
 * the system_settings table. Values are cached in memory and reloaded
 * after every save. Anything not saved yet uses the defaults below
 * (some defaults can also come from .env).
 */

const DEFAULTS = {
  sportfest_name: "Computer Studies Sportfest 2026",
  school_name: "Cristal e-College",
  start_date: "",
  end_date: "",

  default_participation_points: 10,
  default_accomplishment_points: 20,
  fine_per_missed_scan: Number(process.env.FINE_PER_MISSED_SCAN) || 30,

  placement_awards: 3,
  high_performer_points: 100,

  activity_qr_ttl_seconds: Number(process.env.ACTIVITY_QR_TTL_SECONDS) || 120,
  student_qr_ttl_seconds: Number(process.env.STUDENT_QR_TTL_SECONDS) || 300,
  min_minutes_before_time_out: Number(process.env.MIN_MINUTES_BEFORE_TIME_OUT) || 1,

  notify_on_activity_change: true,
};

// [min, max] for numeric settings
const NUMBER_RULES = {
  default_participation_points: [0, 1000],
  default_accomplishment_points: [0, 1000],
  fine_per_missed_scan: [0, 10000],
  placement_awards: [0, 3],
  high_performer_points: [1, 100000],
  activity_qr_ttl_seconds: [30, 86400],
  student_qr_ttl_seconds: [30, 3600],
  min_minutes_before_time_out: [0, 600],
};

let current = { ...DEFAULTS };

function parse(key, raw) {
  const def = DEFAULTS[key];
  if (typeof def === "number") return Number(raw);
  if (typeof def === "boolean") return raw === true || raw === "true" || raw === 1 || raw === "1";
  return String(raw ?? "");
}

function load(db, done = () => {}) {
  db.query("SELECT setting_key, setting_value FROM system_settings", (err, rows) => {
    if (err) {
      console.log("Settings: using defaults (" + err.message + ")");
      return done(err);
    }
    const next = { ...DEFAULTS };
    rows.forEach((r) => {
      if (r.setting_key in DEFAULTS) next[r.setting_key] = parse(r.setting_key, r.setting_value);
    });
    current = next;
    done(null, current);
  });
}

function get(key) {
  return current[key];
}

function all() {
  return { ...current };
}

// Returns { values } with only known, valid keys, or { error }.
function validate(input) {
  const values = {};
  for (const [key, raw] of Object.entries(input || {})) {
    if (!(key in DEFAULTS)) continue;
    const value = parse(key, raw);

    if (NUMBER_RULES[key]) {
      const [min, max] = NUMBER_RULES[key];
      if (!Number.isFinite(value) || value < min || value > max || !Number.isInteger(value)) {
        return { error: `${key.replace(/_/g, " ")} must be a whole number from ${min} to ${max}.` };
      }
    }
    if ((key === "start_date" || key === "end_date") && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { error: `${key.replace(/_/g, " ")} must be a date.` };
    }
    if (typeof value === "string" && value.length > 200) {
      return { error: `${key.replace(/_/g, " ")} is too long.` };
    }
    values[key] = value;
  }
  if (values.start_date && values.end_date && values.start_date > values.end_date) {
    return { error: "The end date must be on or after the start date." };
  }
  return { values };
}

module.exports = { DEFAULTS, load, get, all, validate };
