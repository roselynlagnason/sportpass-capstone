import { useEffect, useRef, useState } from "react";
import { startCameraScanner, cameraErrorMessage, type CameraScanner } from "../lib/qrScanner";
import { QrCode, CheckCircle, AlertCircle, RefreshCw, Camera, CloudOff } from "lucide-react";
import { saveScan, shouldSave } from "../lib/offlineQueue";
import { apiFetch } from "../lib/api";

export function ActivityScanner() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"success" | "saved" | "error" | "">("");
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<CameraScanner | null>(null);
  const scanLocked = useRef(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const stopScanner = async () => {
    try {
      await scannerRef.current?.clear();
      scannerRef.current = null;
    } catch {
      scannerRef.current = null;
    }
  };

  const startScanner = async () => {
    setMessage("");
    setStatus("");
    scanLocked.current = false;

    await stopScanner();

    try {
      scannerRef.current = await startCameraScanner(
        "activity-reader",
        async (decodedText) => {
          if (scanLocked.current) return;
          scanLocked.current = true;

          await stopScanner();
          setScanning(false);

          // No internet (or older saved scans still waiting): keep the scan
          // on this phone; points are added when it syncs.
          const saveOnDevice = () => {
            const saved = saveScan("participation", { token: decodedText }, "SPORTPASS_ACTIVITY_QR");
            setStatus(saved.ok ? "saved" : "error");
            setMessage(saved.message);
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

            const data = await response.json();

            if (!response.ok) {
              setStatus("error");
              setMessage(data.message || "Scan failed.");
              return;
            }

            setStatus("success");
            setMessage(data.message);
          } catch {
            // The connection dropped: save the scan instead of losing it.
            saveOnDevice();
          }
        }
      );
    } catch (cameraError) {
      setStatus("error");
      setMessage(cameraErrorMessage(cameraError));
      setScanning(false);
    }
  };

  useEffect(() => {
    if (scanning) {
      setTimeout(() => {
        startScanner();
      }, 300);
    }

    return () => {
      stopScanner();
    };
  }, [scanning]);

  const restartScanner = () => {
    setMessage("");
    setStatus("");
    setScanning(true);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          Activity Scanner
        </h2>
        <p className="text-muted-foreground text-sm">
          Scan the activity QR code to record participation or accomplishment points.
        </p>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {scanning ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Camera size={18} style={{ color: "var(--primary)" }} />
              <h3 className="font-heading font-bold text-foreground">
                Camera Scanner
              </h3>
            </div>

            <div
              id="activity-reader"
              className="overflow-hidden rounded-xl border bg-black min-h-[280px]"
              style={{ borderColor: "var(--border)" }}
            />

            <p className="text-xs text-muted-foreground text-center mt-3">
              Point the camera at the activity QR code.
            </p>
          </div>
        ) : (
          <div className="text-center py-8">
            {status === "saved" ? (
              <CloudOff size={56} className="mx-auto mb-4" style={{ color: "#D97706" }} />
            ) : status === "success" ? (
              <CheckCircle size={56} className="mx-auto mb-4" style={{ color: "#10B981" }} />
            ) : (
              <AlertCircle size={56} className="mx-auto mb-4" style={{ color: "#EF4444" }} />
            )}

            <h3 className="font-heading font-bold text-foreground text-lg">
              {status === "saved" ? "Saved on This Phone" : status === "success" ? "Scan Successful" : "Scan Failed"}
            </h3>

            <p className="text-sm text-muted-foreground mt-2">{message}</p>

            <button
              onClick={restartScanner}
              className="mt-5 flex items-center justify-center gap-2 mx-auto px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background: "var(--primary)" }}
            >
              <RefreshCw size={15} />
              Scan Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}