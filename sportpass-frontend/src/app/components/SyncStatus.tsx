import { useState } from "react";
import { CloudOff, RefreshCw, CheckCircle, XCircle, ChevronDown, ChevronUp, X } from "lucide-react";
import { clearSyncResults, syncNow, useOfflineStatus } from "../lib/offlineQueue";

// A thin bar under the page header showing offline mode, scans waiting to
// sync, and what happened to scans that synced.
export function SyncStatus() {
  const { online, pending, results, syncing } = useOfflineStatus();
  const [open, setOpen] = useState(false);

  const rejected = results.filter((r) => !r.ok);
  const synced = results.filter((r) => r.ok);

  if (online && pending.length === 0 && results.length === 0) return null;

  let tone = { bg: "#EFF6FF", fg: "#1D4ED8", border: "#BFDBFE" };
  let icon = <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />;
  let text = "";

  if (!online) {
    tone = { bg: "#FFFBEB", fg: "#92400E", border: "#FDE68A" };
    icon = <CloudOff size={14} />;
    text =
      pending.length > 0
        ? `You're offline. ${pending.length} scan${pending.length === 1 ? "" : "s"} saved on this device, waiting to sync.`
        : "You're offline. Scans will be saved on this device and synced when you're back online.";
  } else if (pending.length > 0) {
    text = syncing
      ? `Syncing ${pending.length} saved scan${pending.length === 1 ? "" : "s"}…`
      : `${pending.length} saved scan${pending.length === 1 ? "" : "s"} waiting to sync.`;
  } else {
    tone = rejected.length
      ? { bg: "#FEF2F2", fg: "#B91C1C", border: "#FECACA" }
      : { bg: "#ECFDF5", fg: "#047857", border: "#A7F3D0" };
    icon = rejected.length ? <XCircle size={14} /> : <CheckCircle size={14} />;
    text = `Offline scans synced: ${synced.length} saved to the server${
      rejected.length ? `, ${rejected.length} not accepted` : ""
    }.`;
  }

  return (
    <div className="border-b text-xs" style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}>
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2">
        <span className="flex-shrink-0">{icon}</span>
        <span className="flex-1 min-w-0 font-semibold">{text}</span>

        {(pending.length > 0 || results.length > 0) && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-0.5 font-semibold underline-offset-2 hover:underline flex-shrink-0"
          >
            Details {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
        {online && pending.length > 0 && !syncing && (
          <button type="button" onClick={() => syncNow()} className="font-bold hover:underline flex-shrink-0">
            Sync now
          </button>
        )}
        {online && pending.length === 0 && results.length > 0 && (
          <button type="button" aria-label="Dismiss" onClick={() => { clearSyncResults(); setOpen(false); }} className="p-0.5 flex-shrink-0">
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <ul className="px-4 sm:px-5 pb-2 space-y-1 max-h-48 overflow-y-auto">
          {pending.map((s) => (
            <li key={s.id} className="flex gap-2">
              <span className="font-semibold">Waiting</span>
              <span className="flex-1 min-w-0">
                {s.label} · {new Date(s.scannedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                {s.lastError ? ` · ${s.lastError}` : ""}
              </span>
            </li>
          ))}
          {results.map((r) => (
            <li key={r.id} className="flex gap-2">
              <span className="font-semibold" style={{ color: r.ok ? "#047857" : "#B91C1C" }}>
                {r.ok ? "Synced" : "Not accepted"}
              </span>
              <span className="flex-1 min-w-0">
                {r.label} · {r.message}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
