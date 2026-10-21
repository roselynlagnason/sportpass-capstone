import { apiFetch } from "./api";

// System settings saved by admins on the Settings page (stored on the server).
export type SystemSettings = {
  sportfest_name: string;
  school_name: string;
  start_date: string;
  end_date: string;
  default_participation_points: number;
  default_accomplishment_points: number;
  fine_per_missed_scan: number;
  placement_awards: number;
  high_performer_points: number;
  activity_qr_ttl_seconds: number;
  student_qr_ttl_seconds: number;
  min_minutes_before_time_out: number;
  notify_on_activity_change: boolean;
};

export const DEFAULT_SETTINGS: SystemSettings = {
  sportfest_name: "Computer Studies Sportfest 2026",
  school_name: "Cristal e-College",
  start_date: "",
  end_date: "",
  default_participation_points: 10,
  default_accomplishment_points: 20,
  fine_per_missed_scan: 30,
  placement_awards: 3,
  high_performer_points: 100,
  activity_qr_ttl_seconds: 120,
  student_qr_ttl_seconds: 300,
  min_minutes_before_time_out: 1,
  notify_on_activity_change: true,
};

let cached: SystemSettings = { ...DEFAULT_SETTINGS };

export function getSettings() {
  return cached;
}

export function setCachedSettings(next: Partial<SystemSettings>) {
  cached = { ...cached, ...next };
}

// Returns whether the settings came from the database.
export async function loadSettings(): Promise<boolean> {
  try {
    const response = await apiFetch("/api/settings");
    if (!response.ok) return false;
    const data = await response.json();
    setCachedSettings(data.settings || {});
    return Boolean(data.database);
  } catch {
    return false;
  }
}

// Per-browser look: the primary color. Applied at startup and when changed.
const COLOR_KEY = "sportpass_primary_color";

export function getPrimaryColor() {
  try {
    return localStorage.getItem(COLOR_KEY) || "#2563EB";
  } catch {
    return "#2563EB";
  }
}

export function applyPrimaryColor(color = getPrimaryColor()) {
  document.documentElement.style.setProperty("--primary", color);
  try {
    localStorage.setItem(COLOR_KEY, color);
  } catch {}
}
