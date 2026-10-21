import { useEffect, useRef, useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  Trophy,
  CheckCircle,
  Star,
  QrCode,
  AlertCircle,
  RefreshCw,
  Camera,
} from "lucide-react";

import { Html5QrcodeScanner } from "html5-qrcode";
import { apiFetch } from "../lib/api";


interface Activity {
  activity_id: number;
  sport_name: string;
  activity_name: string;
  activity_date: string;
  activity_time: string;
  activity_location: string;
  participation_requirement?: string | null;
  points: number;
  participation_points: number;
  accomplishment_points: number;
  status: string;
}

export function StudentActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState("All");
  const [search, setSearch] = useState("");
  
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"success" | "error" | "">("");
  const [scanning, setScanning] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scanLocked = useRef(false);



 const user = JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchActivities();
  }, []);

  async function fetchActivities() {
    try {
      const res = await apiFetch("/api/activities");
      const data = await res.json();

      setActivities(data);
    } catch {
      alert("Unable to load activities.");
    } finally {
      setLoading(false);
    }
  }

  const sports = [
    "All",
    ...new Set(activities.map((a) => a.sport_name)),
  ];

  const filtered = activities.filter((a) => {
    const sport =
      sportFilter === "All" || a.sport_name === sportFilter;

    const keyword =
      a.activity_name.toLowerCase().includes(search.toLowerCase()) ||
      a.sport_name.toLowerCase().includes(search.toLowerCase());

    return sport && keyword;
  });

  const upcoming = activities.filter((a) => a.status === "upcoming").length;
  const completed = activities.filter((a) => a.status === "completed").length;
  const ongoing = activities.filter((a) => a.status === "ongoing").length;








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
      const scanner = new Html5QrcodeScanner(
        "activity-reader",
        {
          fps: 10,
          qrbox: { width: 300, height: 300 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [],
        },
        false
      );

      scannerRef.current = scanner;

      scanner.render(
        async (decodedText) => {
          if (scanLocked.current) return;
          scanLocked.current = true;

          await stopScanner();
          setScanning(false);

          try {
            const response = await apiFetch("/api/participation/scan", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token: decodedText,
                student_id: user.student_id,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              setStatus("error");
              setMessage(data.message || "Scan failed.");
              return;
            }

            setStatus("success");
            setMessage(data.message);
            await fetchActivities();
          } catch {
            setStatus("error");
            setMessage("Cannot connect to server.");
          }
        },
        () => {}
      );
    } catch {
      setStatus("error");
      setMessage("Camera permission denied or camera not available.");
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







  if (loading)
    return (
      <div className="text-center py-20 text-muted-foreground">
        Loading activities...
      </div>
    );



  return (
    <div className="space-y-6">



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
            {status === "success" ? (
              <CheckCircle size={56} className="mx-auto mb-4" style={{ color: "#10B981" }} />
            ) : (
              <AlertCircle size={56} className="mx-auto mb-4" style={{ color: "#EF4444" }} />
            )}

            <h3 className="font-heading font-bold text-foreground text-lg">
              {status === "success" ? "Scan Successful" : "Scan Failed"}
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







      <div>
        <h2 className="font-heading font-bold text-foreground text-xl">
          Activities
        </h2>

        <p className="text-muted-foreground text-sm">
          Browse all available sportfest activities.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        <Stat
          title="Total Activities"
          value={activities.length}
          color="#2563EB"
          emoji="📋"
        />

        <Stat
          title="Upcoming"
          value={upcoming}
          color="#F59E0B"
          emoji="⏰"
        />

        <Stat
          title="Ongoing"
          value={ongoing}
          color="#10B981"
          emoji="🏃"
        />

        <Stat
          title="Completed"
          value={completed}
          color="#8B5CF6"
          emoji="🏁"
        />

      </div>

      <div className="flex flex-col lg:flex-row gap-3">

        <input
          className="flex-1 px-4 py-3 rounded-xl border outline-none"
          placeholder="Search activities..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-2 flex-wrap">

          {sports.map((sport) => (
            <button
              key={sport}
              onClick={() => setSportFilter(sport)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                sportFilter === sport
                  ? "text-white"
                  : "border"
              }`}
              style={
                sportFilter === sport
                  ? { background: "var(--primary)" }
                  : {}
              }
            >
              {sport}
            </button>
          ))}

        </div>

      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">

        {filtered.map((activity) => (
          <div
            key={activity.activity_id}
            className="rounded-2xl overflow-hidden border hover:shadow-lg transition-all"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="p-5"
              style={{
                background:
                  "linear-gradient(135deg,#FFF8EE,#FFFFFF)",
              }}
            >
              <div className="flex justify-between items-start">

                <div>

                  <div className="text-3xl mb-2">🏀</div>

                  <h3 className="font-heading font-bold text-lg">
                    {activity.activity_name}
                  </h3>

                  <p className="text-sm text-muted-foreground">
                    {activity.sport_name}
                  </p>

                </div>

                <span
                  className="px-3 py-1 rounded-full text-xs font-bold capitalize"
                  style={{
                    background:
                      activity.status === "completed"
                        ? "#DCFCE7"
                        : activity.status === "ongoing"
                        ? "#DBEAFE"
                        : "#FEF3C7",

                    color:
                      activity.status === "completed"
                        ? "#15803D"
                        : activity.status === "ongoing"
                        ? "#2563EB"
                        : "#D97706",
                  }}
                >
                  {activity.status}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-3">

              <InfoRow
                icon={<Calendar size={15} />}
                text={new Date(activity.activity_date).toLocaleDateString()}
              />

              <InfoRow
                icon={<Clock size={15} />}
                text={activity.activity_time}
              />

              <InfoRow
                icon={<MapPin size={15} />}
                text={activity.activity_location}
              />

              {activity.participation_requirement && (
                <div
                  className="rounded-xl p-3 text-xs"
                  style={{ background: "var(--muted)" }}
                >
                  <p className="font-semibold text-foreground mb-0.5">
                    Requirements
                  </p>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {activity.participation_requirement}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">

                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: "#DBEAFE" }}
                >
                  <Star
                    size={18}
                    className="mx-auto mb-1"
                    color="#2563EB"
                  />

                  <p className="text-lg font-bold text-blue-700">
                    {activity.participation_points}
                  </p>

                   <p className="text-lg font-bold text-blue-700">
                    {activity.accomplishment_points}
                  </p>

                  <p className="text-xs text-blue-700">
                    Participation
                  </p>
                </div>

                <div
                  className="rounded-xl p-3 text-center"
                  style={{ background: "#FEF3C7" }}
                >
                  <Trophy
                    size={18}
                    className="mx-auto mb-1"
                    color="#D97706"
                  />

                  <p className="text-lg font-bold text-yellow-700">
                    {activity.points * 2}
                  </p>

                  <p className="text-xs text-yellow-700">
                    Accomplishment
                  </p>
                </div>

              </div>

              <button
                className="w-full py-3 rounded-xl text-white font-semibold mt-2"
                style={{
                  background: "var(--primary)",
                }}
              >
                View Details
              </button>

            </div>

          </div>
        ))}

      </div>

    </div>
  );
}

function Stat({
  title,
  value,
  color,
  emoji,
}: any) {
  return (
    <div
      className="rounded-2xl p-5 border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div className="text-2xl">{emoji}</div>

      <p
        className="text-3xl font-heading font-bold mt-2"
        style={{ color }}
      >
        {value}
      </p>

      <p className="text-xs text-muted-foreground mt-1">
        {title}
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  text,
}: any) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon}
      <span>{text}</span>
    </div>
  );
}
