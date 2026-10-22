import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, RefreshCw, Shield, Info } from "lucide-react";
import { apiFetch } from "../lib/api";

interface LoggedUser {
  user_id: number;
  email: string;
  role: string;
  student_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  contact?: string;
  department?: string;
  year_level?: string;
  section?: string;
  profile_photo?: string | null;
}

export function StudentQRCode() {
  const [refreshed, setRefreshed] = useState(false);
  const [user, setUser] = useState<LoggedUser | null>(null);
  const qrRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
  const savedUser = localStorage.getItem("user");

  if (savedUser) {
    const parsedUser = JSON.parse(savedUser);
    setUser(parsedUser);
    generateQRToken(parsedUser);
  }
}, []);

useEffect(() => {
  if (!user) return;

  const timer = setInterval(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        generateQRToken(user);
        return 30;
      }

      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timer);
}, [user]);

  const handleRefresh = () => {
  if (user) {
    generateQRToken(user);
  }

  setRefreshed(true);
  setTimeout(() => setRefreshed(false), 2000);
};

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector("canvas");

    if (!canvas) {
      alert("QR Code not found.");
      return;
    }

    const pngUrl = canvas
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");

    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `${user?.student_id || "sportpass"}-qr.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const fullName =
    user?.full_name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    "Student";

  // const qrValue = JSON.stringify({
  //   type: "SPORTPASS_ATTENDANCE",
  //   student_id: user?.student_id || "",
  //   name: fullName,
  // });
  const [qrValue, setQrValue] = useState("");
const [secondsLeft, setSecondsLeft] = useState(30);

const [offlineUntil, setOfflineUntil] = useState<string | null>(null);
const offlineKey = (u: LoggedUser) => `sportpass_offline_qr_${u.student_id || u.user_id}`;

// Shows a fresh QR from the server. Without internet, shows the offline
// pass saved on the last visit (valid until the end of that day).
const generateQRToken = async (studentUser: LoggedUser) => {
  try {
    const response = await apiFetch("/api/auth/student-qr-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (response.ok) {
      setQrValue(data.token);
      setSecondsLeft(data.expires_in);
      setOfflineUntil(null);
      if (data.offline_token) {
        try {
          localStorage.setItem(
            offlineKey(studentUser),
            JSON.stringify({ token: data.offline_token, until: data.offline_expires_at })
          );
        } catch {
          /* storage unavailable */
        }
      }
    }
  } catch {
    let saved: { token: string; until: string } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(offlineKey(studentUser)) || "null");
    } catch {
      saved = null;
    }
    if (saved && new Date(saved.until).getTime() > Date.now()) {
      setQrValue(saved.token);
      setOfflineUntil(saved.until);
    } else {
      setQrValue("");
      setOfflineUntil("none");
    }
    setSecondsLeft(30); // check for internet again soon
  }
};

  const qrCodeId = user?.student_id
    ? `SP-${user.student_id}`
    : "SP-NO-STUDENT-ID";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          My QR Code
        </h2>
        <p className="text-muted-foreground text-sm">
          Present this QR code for time-in and time-out scanning at each event
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden shadow-1xl border"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="px-6 py-5 text-white"
          style={{ background: "linear-gradient(135deg, #0F2450, #2563EB)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-widest">
                SPORTPASS
              </p>
              <p className="text-white font-heading font-bold">
                Student ID Card
              </p>
            </div>

            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "#F59E0B" }}
            >
              <Shield size={16} className="text-white" />
            </div>
          </div>
        </div>

        <div className="p-6 bg-white">
          <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
            <div className="flex-shrink-0">
              <div
                ref={qrRef}
                className="w-44 h-44 rounded-2xl border-4 flex items-center justify-center bg-white p-3"
                style={{ borderColor: "var(--primary)" }}
              >
                <QRCodeCanvas
                  value={qrValue || "SPORTPASS"}
                  style={{ width: "100%", height: "100%", opacity: qrValue ? 1 : 0.1 }}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <br></br>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Scan for attendance
              </p>
              {offlineUntil === null ? (
                <p className="text-center text-xs font-semibold mt-1" style={{ color: "#EF4444" }}>
                  Expires in {secondsLeft}s
                </p>
              ) : offlineUntil === "none" ? (
                <p className="text-center text-xs font-semibold mt-1 max-w-44" style={{ color: "#B45309" }}>
                  You're offline. Open this page once while online to get an offline QR.
                </p>
              ) : (
                <p className="text-center text-xs font-semibold mt-1 max-w-44" style={{ color: "#B45309" }}>
                  Offline QR · valid until 11:59 PM today
                </p>
              )}

            </div>
            

            <div className="flex-1 space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Full Name
                </p>
                  <p className="font-heading font-bold text-foreground text-lg">
                    {fullName}
                  </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Student ID
                  </p>
                  <p className="font-semibold text-foreground text-sm">
                    {user?.student_id || "N/A"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Year Level
                  </p>
                  <p className="font-semibold text-foreground text-sm">
                    {user?.year_level || "N/A"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Section
                </p>
                <p className="font-semibold text-foreground text-sm">
                  {user?.section || "N/A"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  QR Code ID
                </p>
                <p
                  className="font-semibold text-foreground font-mono text-xs"
                  style={{ color: "var(--primary)" }}
                >
                  {qrCodeId}
                </p>
              </div>

              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "#10B98118" }}
              >
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#10B981" }}
                >
                  Active – Valid for Sportfest 2026
                </span>
              </div>
            </div>
          </div>
        </div>

        <div
          className="px-6 py-3 flex items-center justify-between"
          style={{ background: "#F59E0B" }}
        >
          <p className="text-xs font-bold" style={{ color: "#1E293B" }}>
            Cristal e-College · Computer Studies Sportfest 
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all"
          style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
        >
          <RefreshCw size={15} className={refreshed ? "animate-spin" : ""} />
          {refreshed ? "Refreshed!" : "Refresh QR"}
        </button>

        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90 transition-all"
          style={{ background: "var(--primary)" }}
        >
          <Download size={15} />
          Download QR Card
        </button>
      </div>

      <div
        className="rounded-2xl p-5 border"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <Info size={15} style={{ color: "var(--primary)" }} />
          <h3 className="font-heading font-bold text-foreground text-sm">
            How to Use
          </h3>
        </div>

        <div className="space-y-2.5">
          {[
            { step: 1, text: "Go to the event venue at the scheduled time" },
            {
              step: 2,
              text: "Show this QR code to the Event Officer at the entrance for Time-In scanning",
            },
            {
              step: 3,
              text: "At the end of the event, present your QR again for Time-Out scanning",
            },
            {
              step: 4,
              text: "Missing a scan = ₱30 automatic fine per missed record",
            },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
                style={{ background: "var(--primary)" }}
              >
                {s.step}
              </div>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}