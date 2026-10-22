import { AlertCircle, RefreshCw } from "lucide-react";

// Shared loading and error states so every page looks the same while
// waiting for the server or when a request fails.

export function PageLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground" role="status" aria-live="polite">
      <div
        className="w-8 h-8 rounded-full border-[3px] animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }}
      />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function PageError({
  message = "Something went wrong while loading this page.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="max-w-md mx-auto my-12 rounded-2xl border p-6 text-center"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
      role="alert"
    >
      <AlertCircle size={28} className="mx-auto mb-3" style={{ color: "#EF4444" }} />
      <p className="text-sm font-semibold text-foreground">{message}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Check your internet connection. If the server was idle, it may need a minute to wake up.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-bold hover:opacity-90"
          style={{ background: "var(--primary)" }}
        >
          <RefreshCw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground text-center py-8">{text}</p>;
}

// ₱1,250 style amounts and 1,250 style counts.
export const peso = (n: unknown) => `₱${Number(n || 0).toLocaleString("en-PH")}`;
export const num = (n: unknown) => Number(n || 0).toLocaleString("en-PH");
