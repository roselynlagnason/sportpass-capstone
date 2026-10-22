/*
 * Offline-first scanning.
 *
 * When there is no internet, a scan is saved on this device (localStorage)
 * with the time it was scanned and a unique scan id. When the connection
 * comes back, saved scans are sent to the server in the order they were
 * made. The server checks each QR code as of its scan time, and the scan id
 * stops a scan from being recorded twice.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export type ScanKind = "attendance" | "participation";

export interface SavedScan {
  id: string;
  kind: ScanKind;
  userId: number | null;
  payload: Record<string, unknown>;
  scannedAt: string; // ISO time on this device
  label: string; // what to show the user, e.g. "Ana Cruz"
  attempts: number;
  lastError?: string;
}

export interface SyncResult {
  id: string;
  label: string;
  kind: ScanKind;
  ok: boolean;
  message: string;
  at: string;
}

const QUEUE_KEY = "sportpass_offline_scans";
const RESULTS_KEY = "sportpass_sync_results";
const CHANGE_EVENT = "sportpass-offline-change";
const ENDPOINT: Record<ScanKind, string> = {
  attendance: "/api/attendance/scan",
  participation: "/api/participation/scan",
};

// ---- storage -----------------------------------------------------------

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function currentUserId(): number | null {
  const user = read<{ user_id?: number } | null>("user", null);
  return user?.user_id ?? null;
}

const allScans = () => read<SavedScan[]>(QUEUE_KEY, []);

/** Saved scans belonging to the logged-in user, oldest first. */
export function savedScans(kind?: ScanKind): SavedScan[] {
  const me = currentUserId();
  return allScans().filter((s) => s.userId === me && (!kind || s.kind === kind));
}

export function syncResults(): SyncResult[] {
  return read<SyncResult[]>(RESULTS_KEY, []);
}

export function clearSyncResults() {
  write(RESULTS_KEY, []);
}

function addResult(scan: SavedScan, ok: boolean, message: string) {
  const list = [
    { id: scan.id, label: scan.label, kind: scan.kind, ok, message, at: new Date().toISOString() },
    ...syncResults(),
  ].slice(0, 30);
  write(RESULTS_KEY, list);
}

function removeScan(id: string) {
  write(QUEUE_KEY, allScans().filter((s) => s.id !== id));
}

function updateScan(id: string, changes: Partial<SavedScan>) {
  write(QUEUE_KEY, allScans().map((s) => (s.id === id ? { ...s, ...changes } : s)));
}

// ---- QR helpers ----------------------------------------------------------

/** Reads a QR token's contents without checking it (the server checks it). */
export function readQr(token: string): Record<string, any> | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function newId() {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID() as string;
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ---- saving ----------------------------------------------------------------

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

/**
 * Should this scan be saved on the device instead of sent now?
 * Yes when offline, and also when older saved scans of the same kind are
 * still waiting, so scans always reach the server in the order they were made.
 */
export function shouldSave(kind: ScanKind) {
  return !isOnline() || savedScans(kind).length > 0;
}

/**
 * Checks a scanned QR code on the device and saves it.
 * Returns a message for the person scanning.
 */
export function saveScan(
  kind: ScanKind,
  payload: { token: string } & Record<string, unknown>,
  expectedType: string
): { ok: boolean; message: string; label: string } {
  const qr = readQr(payload.token);
  if (!qr || qr.type !== expectedType) {
    return {
      ok: false,
      label: "",
      message: kind === "attendance" ? "This is not a student attendance QR code." : "This is not an activity QR code.",
    };
  }

  const nowSec = Date.now() / 1000;
  if (qr.exp && qr.exp < nowSec) {
    return {
      ok: false,
      label: "",
      message:
        kind === "attendance"
          ? "This QR code has expired. Ask the student to refresh their QR."
          : "This QR code has expired. Scan the code the officer is showing now.",
    };
  }

  const label =
    kind === "attendance"
      ? String(qr.full_name || qr.student_id || "Student")
      : qr.qr_type === "accomplishment"
      ? "Accomplishment points"
      : "Participation points";

  const mine = savedScans(kind);
  if (mine.some((s) => s.payload.token === payload.token)) {
    return { ok: false, label, message: `${label}: this scan is already saved.` };
  }
  if (
    kind === "attendance" &&
    mine.some(
      (s) =>
        readQr(String(s.payload.token))?.student_id === qr.student_id &&
        s.payload.day_id === payload.day_id &&
        Date.now() - new Date(s.scannedAt).getTime() < 60 * 1000
    )
  ) {
    return { ok: false, label, message: `${label} was scanned less than a minute ago.` };
  }

  const scan: SavedScan = {
    id: newId(),
    kind,
    userId: currentUserId(),
    payload,
    scannedAt: new Date().toISOString(),
    label,
    attempts: 0,
  };
  write(QUEUE_KEY, [...allScans(), scan]);

  // Try right away in case the connection is actually fine.
  setTimeout(() => {
    syncNow();
  }, 300);

  return {
    ok: true,
    label,
    message: isOnline()
      ? `${label}: saved and sending now…`
      : `${label}: saved on this device. It will sync automatically when you're back online.`,
  };
}

// ---- syncing ---------------------------------------------------------------

let running: Promise<void> | null = null;

/** Sends saved scans to the server, oldest first. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (running) return running;
  const job = sendSavedScans().finally(() => {
    running = null;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  });
  running = job;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return job;
}

async function sendSavedScans() {
  if (!isOnline()) return;
  for (const scan of savedScans()) {
    let response: Response;
    try {
      response = await apiFetch(ENDPOINT[scan.kind], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scan.payload, scanned_at: scan.scannedAt, client_id: scan.id }),
      });
    } catch {
      return; // still no connection; try again later
    }

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      removeScan(scan.id);
      addResult(scan, true, data.message || "Synced.");
    } else if (response.status === 401) {
      return; // logged out; the scan stays saved for the next login
    } else if (response.status >= 500) {
      updateScan(scan.id, { attempts: scan.attempts + 1, lastError: "Server problem, will retry." });
      return;
    } else if (data.retry) {
      updateScan(scan.id, { attempts: scan.attempts + 1, lastError: data.message });
    } else {
      removeScan(scan.id);
      addResult(scan, false, data.message || "The server did not accept this scan.");
    }
  }
}

/** Starts automatic syncing: on reconnect, on start, and every 30 seconds. */
export function startAutoSync() {
  const onOnline = () => syncNow();
  window.addEventListener("online", onOnline);
  const timer = window.setInterval(() => {
    if (savedScans().length > 0) syncNow();
  }, 30000);
  syncNow();
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(timer);
  };
}

/** Live view of connection and sync state for the UI. */
export function useOfflineStatus() {
  const snapshot = () => ({
    online: isOnline(),
    pending: savedScans(),
    results: syncResults(),
    syncing: running !== null,
  });
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    const refresh = () => setState(snapshot());
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return state;
}

/** True when a request failed because there's no connection. */
export function isNetworkError(err: unknown) {
  return err instanceof TypeError || !isOnline();
}
