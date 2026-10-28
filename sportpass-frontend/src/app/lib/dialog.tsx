/*
 * In-app dialogs that replace the browser's alert() and confirm() boxes.
 *
 *   await alertDialog("Saved.")                       // information
 *   await alertDialog("Couldn't save.", { tone: "error" })
 *   if (await confirmDialog({ title: "Delete?", message: "...", tone: "danger" })) { ... }
 *
 * <DialogHost /> is mounted once at the root (main.tsx) and shows them.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Info, LogOut, XCircle } from "lucide-react";

export type DialogTone = "info" | "success" | "error" | "danger" | "warning";

export interface DialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
  icon?: "logout";
}

interface OpenDialog extends DialogOptions {
  id: number;
  kind: "alert" | "confirm";
  resolve: (ok: boolean) => void;
}

let show: ((d: OpenDialog) => void) | null = null;
let nextId = 1;

// Messages that read like problems are shown as errors automatically.
const looksLikeError = (m: string) =>
  /fail|cannot|can't|unable|error|not found|invalid|denied|went wrong/i.test(m);

function open(kind: "alert" | "confirm", input: string | DialogOptions): Promise<boolean> {
  const opts: DialogOptions = typeof input === "string" ? { message: input } : input;
  return new Promise((resolve) => {
    if (!show) {
      // Host not mounted yet: fall back to the browser box.
      resolve(kind === "confirm" ? window.confirm(opts.message) : (window.alert(opts.message), true));
      return;
    }
    show({ ...opts, kind, id: nextId++, resolve });
  });
}

export function alertDialog(message: string | DialogOptions, extra: Partial<DialogOptions> = {}) {
  const opts = typeof message === "string" ? { message, ...extra } : { ...message, ...extra };
  return open("alert", opts).then(() => undefined);
}

export function confirmDialog(options: string | DialogOptions) {
  return open("confirm", options);
}

const TONES: Record<DialogTone, { color: string; bg: string; title: string }> = {
  info: { color: "#2563EB", bg: "#2563EB18", title: "Notice" },
  success: { color: "#10B981", bg: "#10B98118", title: "Done" },
  error: { color: "#EF4444", bg: "#EF444418", title: "Something went wrong" },
  danger: { color: "#EF4444", bg: "#EF444418", title: "Are you sure?" },
  warning: { color: "#F59E0B", bg: "#F59E0B18", title: "Please check" },
};

export function DialogHost() {
  const [queue, setQueue] = useState<OpenDialog[]>([]);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const current = queue[0];

  useEffect(() => {
    show = (d) => setQueue((q) => [...q, d]);
    return () => {
      show = null;
    };
  }, []);

  const close = (ok: boolean) => {
    if (!current) return;
    current.resolve(ok);
    setQueue((q) => q.slice(1));
  };

  useEffect(() => {
    if (!current) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(current.kind === "alert");
      if (e.key === "Enter") {
        e.preventDefault();
        close(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current]);

  if (!current) return null;

  const tone: DialogTone =
    current.tone ||
    (current.kind === "confirm" ? "info" : looksLikeError(current.message) ? "error" : "info");
  const t = TONES[tone];
  const Icon =
    current.icon === "logout"
      ? LogOut
      : tone === "success"
      ? CheckCircle
      : tone === "error"
      ? XCircle
      : tone === "danger" || tone === "warning"
      ? AlertTriangle
      : Info;
  const title = current.title || (current.kind === "confirm" ? "Please confirm" : t.title);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(15, 23, 42, 0.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(current.kind === "alert");
      }}
    >
      <div
        role={current.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={`dialog-title-${current.id}`}
        aria-describedby={`dialog-message-${current.id}`}
        className="w-full max-w-sm rounded-2xl p-6 shadow-2xl text-center"
        style={{ background: "var(--card)", color: "var(--foreground)" }}
      >
        <div
          className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
          style={{ background: t.bg, color: t.color }}
        >
          <Icon size={22} />
        </div>
        <h2 id={`dialog-title-${current.id}`} className="font-heading font-bold text-lg text-foreground">
          {title}
        </h2>
        <p id={`dialog-message-${current.id}`} className="text-sm text-muted-foreground mt-2 whitespace-pre-line">
          {current.message}
        </p>

        <div className="flex gap-3 mt-6">
          {current.kind === "confirm" && (
            <button
              type="button"
              onClick={() => close(false)}
              className="flex-1 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
              style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              {current.cancelText || "Cancel"}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => close(true)}
            className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all"
            style={{
              background: tone === "danger" || tone === "error" ? "#EF4444" : "var(--primary)",
            }}
          >
            {current.confirmText || (current.kind === "confirm" ? "Confirm" : "OK")}
          </button>
        </div>
      </div>
    </div>
  );
}
