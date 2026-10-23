import { useEffect, useRef, useState } from "react";
import { startCameraScanner, cameraErrorMessage, type CameraScanner } from "../lib/qrScanner";
import { CheckCircle, AlertCircle, RefreshCw, Camera, CloudOff, ScanLine, Lock } from "lucide-react";
import { saveScan, shouldSave } from "../lib/offlineQueue";
import { apiFetch } from "../lib/api";

type Phase = "idle" | "scanning" | "result";
type Status = "success" | "saved" | "error" | "";

// Is the camera already allowed for this site? (Then it can start by itself.)
async function cameraAlreadyAllowed() {
  try {
    const result = await (navigator as any).permissions?.query({ name: "camera" });
    return result?.state === "granted";
  } catch {
    return false;
  }
}

export function ActivityScanner() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<Status>("");
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const scannerRef = useRef<CameraScanner | null>(null);
  const scanLocked = useRef(false);

  const stopScanner = async () => {
    try {
      await scannerRef.current?.clear();
    } catch {
      /* already stopped */
    }
    scannerRef.current = null;
  };

  const showResult = (s: Status, text: string) => {
    setStatus(s);
    setMessage(text);
    setPhase("result");
  };

  const handleCode = async (decodedText: string) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    await stopScanner();

    // No internet (or older saved scans still waiting): keep the scan on
    // this phone; the points are added when it syncs.
    const saveOnDevice = () => {
      const saved = saveScan("participation", { token: decodedText }, "SPORTPASS_ACTIVITY_QR");
      showResult(saved.ok ? "saved" : "error", saved.message);
    };

    if (shouldSave("participation")) {
      saveOnDevice();
      return;
    }

    try {
      const response = await apiFetch("/api/participation/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: decodedText }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        showResult("error", data.message || "Scan failed.");
        return;
      }
      showResult("success", data.message || "Points added.");
    } catch {
      // The connection dropped: save the scan instead of losing it.
      saveOnDevice();
    }
  };

  // Start the camera once the scanner box is on screen.
  useEffect(() => {
    if (phase !== "scanning") return;
    let cancelled = false;
    scanLocked.current = false;

    const timer = setTimeout(async () => {
      try {
        const scanner = await startCameraScanner("activity-reader", handleCode);
        if (cancelled) scanner.clear();
        else scannerRef.current = scanner;
      } catch (err) {
        if (cancelled) return;
        const text = cameraErrorMessage(err);
        setBlocked(/blocked/i.test(text));
        showResult("error", text);
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [phase]);

  // If the camera is already allowed, open it right away.
  useEffect(() => {
    cameraAlreadyAllowed().then((ok) => {
      if (ok) setPhase("scanning");
    });
  }, []);

  const start = () => {
    setBlocked(false);
    setStatus("");
    setMessage("");
    setPhase("scanning");
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">Activity Scanner</h2>
        <p className="text-muted-foreground text-sm">
          Scan the activity QR code to record participation or accomplishment points.
        </p>
      </div>

      <div className="rounded-2xl p-5 border" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        {phase === "idle" && (
          <div className="text-center py-8">
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: "#2563EB18", color: "#2563EB" }}
            >
              <ScanLine size={30} />
            </div>
            <h3 className="font-heading font-bold text-foreground text-lg">Ready to scan</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Tap the button, allow the camera when your browser asks, then point it at the QR code the officer shows.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-bold"
              style={{ background: "var(--primary)" }}
            >
              <Camera size={16} /> Start Camera
            </button>
          </div>
        )}

        {phase === "scanning" && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Camera size={18} style={{ color: "var(--primary)" }} />
              <h3 className="font-heading font-bold text-foreground flex-1">Camera Scanner</h3>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Stop
              </button>
            </div>
            <div
              id="activity-reader"
              className="overflow-hidden rounded-xl border bg-black min-h-[280px]"
              style={{ borderColor: "var(--border)" }}
            />
            <p className="text-xs text-muted-foreground text-center mt-3">
              Hold the phone 20–30 cm from the QR code so it fills the box.
            </p>
          </div>
        )}

        {phase === "result" && (
          <div className="text-center py-8">
            {status === "saved" ? (
              <CloudOff size={56} className="mx-auto mb-4" style={{ color: "#D97706" }} />
            ) : status === "success" ? (
              <CheckCircle size={56} className="mx-auto mb-4" style={{ color: "#10B981" }} />
            ) : blocked ? (
              <Lock size={56} className="mx-auto mb-4" style={{ color: "#EF4444" }} />
            ) : (
              <AlertCircle size={56} className="mx-auto mb-4" style={{ color: "#EF4444" }} />
            )}

            <h3 className="font-heading font-bold text-foreground text-lg">
              {status === "saved"
                ? "Saved on This Phone"
                : status === "success"
                ? "Scan Successful"
                : blocked
                ? "Camera Is Blocked"
                : "Scan Failed"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">{message}</p>

            {blocked && (
              <div
                className="text-left text-sm rounded-xl p-4 mt-4 space-y-2"
                style={{ background: "var(--muted)" }}
              >
                <p className="font-semibold text-foreground">How to allow the camera</p>
                <p className="text-muted-foreground">
                  <b>Computer (Chrome/Edge):</b> click the camera or settings icon at the left of the address bar →
                  Camera → <b>Allow</b>, then reload the page.
                </p>
                <p className="text-muted-foreground">
                  <b>Android (Chrome):</b> tap the icon left of the address → Permissions → Camera → <b>Allow</b>.
                </p>
                <p className="text-muted-foreground">
                  <b>iPhone (Safari):</b> tap <b>aA</b> in the address bar → Website Settings → Camera → <b>Allow</b>.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={start}
              className="mt-5 flex items-center justify-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: "var(--primary)" }}
            >
              <RefreshCw size={15} />
              {status === "error" ? "Try Again" : "Scan Again"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
