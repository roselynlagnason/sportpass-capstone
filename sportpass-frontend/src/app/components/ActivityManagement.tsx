import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Plus,
  Search,
  Calendar,
  MapPin,
  Users,
  Clock,
  Edit2,
  Trash2,
  QrCode,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { getSettings } from "../lib/settings";
import { dayLabel, dayWhen, loadDays, type SportfestDay } from "../lib/sportfestDays";

// MySQL dates arrive as UTC timestamps; read them in local (Philippine)
// time so editing an activity doesn't move it back a day.
function toDateInput(value: any) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const statusColor: Record<string, string> = {
  completed: "#10B981",
  ongoing: "#2563EB",
  upcoming: "#F59E0B",
};

const sportOptions = [
  "Basketball",
  "Volleyball",
  "Badminton",
  "PickleBall",
  "Board Games",
  "Larong Pinoy",
];

const sportIcon: Record<string, string> = {
  Basketball: "🏀",
  Volleyball: "🏐",
  Badminton: "🏸",
  PickleBall: "🏓",
  "Board Games": "♟️",
  "Larong Pinoy": "🏃",
};

export function ActivityManagement() {
  const [activities, setActivities] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [qrCodes, setQrCodes] = useState<any[]>([]);
  const [qrSecondsLeft, setQrSecondsLeft] = useState(0);
  const qrLoading = useRef(false);

  const [form, setForm] = useState({
    sport_name: "",
    activity_name: "",
    activity_date: "",
    activity_time: "",
    activity_location: "",
    participation_requirement: "",
    participation_points: "",
    accomplishment_points: "",
    status: "upcoming",
  });

  const fetchActivities = async () => {
    const response = await apiFetch("/api/activities");
    const data = await response.json();
    setActivities(data);
  };

  // Activities are scheduled on the sportfest days set on the Sportfest Days page.
  const [days, setDays] = useState<SportfestDay[]>([]);

  useEffect(() => {
    fetchActivities();
    loadDays().then(setDays).catch(() => setDays([]));
  }, []);

  const resetForm = () => {
    setForm({
      sport_name: "",
      activity_name: "",
      activity_date: "",
      activity_time: "",
      activity_location: "",
      participation_requirement: "",
      participation_points: String(getSettings().default_participation_points),
      accomplishment_points: String(getSettings().default_accomplishment_points),
      status: "upcoming",
    });
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setShowCreate(true);
  };

  const openEdit = (activity: any) => {
    setEditing(activity);
    setForm({
      sport_name: activity.sport_name || "",
      activity_name: activity.activity_name || "",
      activity_date: toDateInput(activity.activity_date),
      activity_time: activity.activity_time || "",
      activity_location: activity.activity_location || "",
      participation_requirement: activity.participation_requirement || "",
      participation_points: String(activity.participation_points || 0),
      accomplishment_points: String(activity.accomplishment_points || 0),
      status: activity.status || "upcoming",
    });
    setShowCreate(true);
  };

  // Activity QR codes expire quickly ("Activity QR Lifetime" in Settings),
  // so this screen fetches new ones shortly before they expire.
  const loadQRCodes = async (activityId: number) => {
    if (qrLoading.current) return false;
    qrLoading.current = true;

    try {
      const response = await apiFetch(`/api/activities/${activityId}/qrcodes`);
      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Unable to load QR codes.");
        return false;
      }

      setQrCodes(data);
      setQrSecondsLeft(Number(data[0]?.expires_in) || 120);
      return true;
    } catch {
      alert("Cannot connect to server.");
      return false;
    } finally {
      qrLoading.current = false;
    }
  };

  const openManageQR = async (activity: any) => {
    setSelectedActivity(activity);

    if (await loadQRCodes(activity.activity_id)) {
      setShowQRModal(true);
    }
  };

  useEffect(() => {
    if (!showQRModal) return;

    const timer = setInterval(() => {
      setQrSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [showQRModal]);

  useEffect(() => {
    // Refresh 10 seconds before expiry so a student who is mid-scan
    // still has a valid code.
    if (showQRModal && selectedActivity && qrSecondsLeft <= 10) {
      loadQRCodes(selectedActivity.activity_id);
    }
  }, [showQRModal, selectedActivity, qrSecondsLeft]);

  const saveActivity = async () => {
    if (!form.sport_name || !form.activity_name || !form.activity_date) {
      alert("Please fill in sport, activity name, and date.");
      return;
    }

    const payload = {
      ...form,
      participation_points: Number(form.participation_points),
      accomplishment_points: Number(form.accomplishment_points),
      created_by:
        JSON.parse(localStorage.getItem("user") || "{}")?.user_id || null,
    };

    const url = editing
      ? `/api/activities/${editing.activity_id}`
      : "/api/activities";

    const method = editing ? "PUT" : "POST";

    const response = await apiFetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Something went wrong.");
      return;
    }

    alert(data.message);
    setShowCreate(false);
    resetForm();
    fetchActivities();
  };

  const deleteActivity = async (id: number) => {
    if (!confirm("Delete this activity?")) return;

    const response = await apiFetch(`/api/activities/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Delete failed.");
      return;
    }

    alert(data.message);
    fetchActivities();
  };

  const filtered = activities.filter((a) => {
    const keyword = search.toLowerCase();

    return (
      (a.activity_name.toLowerCase().includes(keyword) ||
        a.sport_name.toLowerCase().includes(keyword)) &&
      (sport === "All" || a.sport_name === sport)
    );
  });

  const stats = {
    total: activities.length,
    completed: activities.filter((a) => a.status === "completed").length,
    ongoing: activities.filter((a) => a.status === "ongoing").length,
    upcoming: activities.filter((a) => a.status === "upcoming").length,
  };

  const QRCard = ({ qr }: { qr: any }) => {
    const qrRef = useRef<HTMLDivElement | null>(null);

    return (
      <div
        className="rounded-2xl border p-5 text-center"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <h4 className="font-heading font-bold text-foreground capitalize mb-1">
          {qr.qr_type} QR
        </h4>

        <p className="text-xs text-muted-foreground mb-4">
          {qr.qr_type === "participation"
            ? "Students scan this after joining/participating."
            : "Students scan this after completing/accomplishing."}
        </p>

        <div ref={qrRef} className="flex justify-center bg-white p-4 rounded-xl">
          <QRCodeCanvas value={qr.qr_token} size={512} level="L" marginSize={4} style={{ width: "100%", maxWidth: 300, height: "auto", display: "block" }} />
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Points:{" "}
          <strong>
            {qr.qr_type === "participation"
              ? selectedActivity?.participation_points
              : selectedActivity?.accomplishment_points}
          </strong>
        </p>

        <p className="mt-4 text-xs text-muted-foreground">
          New code in <strong>{Math.max(qrSecondsLeft - 10, 0)}s</strong>.
          Keep this screen open; screenshots and printouts stop working.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <h2 className="font-heading font-bold text-foreground text-xl">
            Activity Management
          </h2>
          <p className="text-muted-foreground text-sm">
            Manage Computer Studies sportfest activities
          </p>
        </div>

        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
          style={{ background: "var(--primary)" }}
        >
          <Plus size={16} /> Create Activity
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Activities", value: stats.total, color: "#2563EB", icon: "📋" },
          { label: "Completed", value: stats.completed, color: "#10B981", icon: "✅" },
          { label: "Ongoing", value: stats.ongoing, color: "#3B82F6", icon: "🔵" },
          { label: "Upcoming", value: stats.upcoming, color: "#F59E0B", icon: "🕐" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl p-4 border"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <span className="text-xl">{s.icon}</span>
            <p className="text-2xl font-heading font-bold mt-2" style={{ color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            placeholder="Search activities..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
              color: "var(--foreground)",
            }}
          />
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {["All", ...sportOptions].map((s) => (
            <button
              key={s}
              onClick={() => setSport(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                sport === s
                  ? "text-white"
                  : "text-muted-foreground border hover:text-foreground"
              }`}
              style={
                sport === s
                  ? { background: "var(--primary)" }
                  : { borderColor: "var(--border)" }
              }
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((a) => (
          <div
            key={a.activity_id}
            className="rounded-2xl border overflow-hidden hover:shadow-lg transition-all group"
            style={{ background: "var(--card)", borderColor: "var(--border)" }}
          >
            <div
              className="p-5 pb-4"
              style={{ background: statusColor[a.status] + "12" }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="text-3xl">{sportIcon[a.sport_name] || "🏆"}</div>
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-semibold capitalize"
                  style={{
                    background: statusColor[a.status] + "20",
                    color: statusColor[a.status],
                  }}
                >
                  {a.status}
                </span>
              </div>

              <h3 className="font-heading font-bold text-foreground text-base leading-tight">
                {a.activity_name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">{a.sport_name}</p>
            </div>

            <div className="p-5 pt-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar size={13} style={{ color: "var(--primary)" }} />
                <span>{new Date(a.activity_date).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock size={13} style={{ color: "var(--primary)" }} />
                <span>{a.activity_time || "No time set"}</span>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={13} style={{ color: "var(--primary)" }} />
                <span>{a.activity_location || "No venue set"}</span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users size={13} style={{ color: "var(--primary)" }} />
                  <span>Students scan activity QR</span>
                </div>
                <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
                  P: {a.participation_points} · A: {a.accomplishment_points}
                </span>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => openEdit(a)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold hover:bg-muted transition-all"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                >
                  <Edit2 size={12} /> Edit
                </button>

                <button
                  onClick={() => deleteActivity(a.activity_id)}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold hover:bg-red-50 hover:text-red-500 transition-all"
                  style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
                >
                  <Trash2 size={12} />
                </button>

                <button
                  onClick={() => openManageQR(a)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-all"
                  style={{ background: "var(--primary)" }}
                >
                  <QrCode size={12} /> Manage
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showQRModal && selectedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
            style={{ background: "var(--card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-heading font-bold text-foreground text-lg">
                  Manage Activity QR Codes
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedActivity.sport_name} · {selectedActivity.activity_name}
                </p>
              </div>

              <button
                onClick={() => setShowQRModal(false)}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            {qrCodes.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground">
                No QR codes found for this activity.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {qrCodes.map((qr) => (
                  <QRCard key={qr.qr_type} qr={qr} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div
            className="w-full max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto"
            style={{ background: "var(--card)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-heading font-bold text-foreground text-lg">
                {editing ? "Edit Activity" : "Create New Activity"}
              </h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="text-muted-foreground hover:text-foreground text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">
                  Sport/Event
                </label>
                <select
                  value={form.sport_name}
                  onChange={(e) =>
                    setForm((a) => ({ ...a, sport_name: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="">Select sport...</option>
                  {sportOptions.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">
                  Activity Name
                </label>
                <input
                  value={form.activity_name}
                  onChange={(e) =>
                    setForm((a) => ({ ...a, activity_name: e.target.value }))
                  }
                  placeholder="e.g. Elimination Round, Finals, Group A"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="activity-day" className="text-sm font-semibold text-foreground mb-1.5 block">
                    Sportfest Day
                  </label>
                  <select
                    id="activity-day"
                    value={form.activity_date}
                    onChange={(e) =>
                      setForm((a) => ({ ...a, activity_date: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="">
                      {days.length ? "Choose a day" : "No sportfest days yet"}
                    </option>
                    {[...days]
                      .sort((x, y) => x.date_key.localeCompare(y.date_key))
                      .filter((d) => dayWhen(d) !== "past" || d.date_key === form.activity_date)
                      .map((d) => (
                        <option key={d.day_id} value={d.date_key}>
                          {dayLabel(d, days)}
                        </option>
                      ))}
                  </select>
                  {days.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Add the sportfest days first on the Sportfest Days page.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Time
                  </label>
                  <input
                    type="time"
                    value={form.activity_time}
                    onChange={(e) =>
                      setForm((a) => ({ ...a, activity_time: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground mb-1.5 block">
                  Venue
                </label>
                <input
                  value={form.activity_location}
                  onChange={(e) =>
                    setForm((a) => ({
                      ...a,
                      activity_location: e.target.value,
                    }))
                  }
                  placeholder="e.g. Main Gymnasium"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div>
                <label htmlFor="activity-requirement" className="text-sm font-semibold text-foreground mb-1.5 block">
                  Participation Requirements
                </label>
                <textarea
                  id="activity-requirement"
                  rows={2}
                  value={form.participation_requirement}
                  onChange={(e) =>
                    setForm((a) => ({
                      ...a,
                      participation_requirement: e.target.value,
                    }))
                  }
                  placeholder="e.g. Teams of 5, wear PE uniform, register with your class officer"
                  className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

  {/* Participation Points */}
  <div>
    <label className="text-sm font-semibold text-foreground mb-1.5 block">
      Participation Points
    </label>

    <input
      type="number"
      value={form.participation_points}
      onChange={(e) =>
        setForm((a) => ({
          ...a,
          participation_points: e.target.value,
        }))
      }
      placeholder="e.g. 10"
      className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
      style={{
        background: "var(--input-background)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    />
  </div>

  {/* Accomplishment Points */}
  <div>
    <label className="text-sm font-semibold text-foreground mb-1.5 block">
      Accomplishment Points
    </label>

    <input
      type="number"
      value={form.accomplishment_points}
      onChange={(e) =>
        setForm((a) => ({
          ...a,
          accomplishment_points: e.target.value,
        }))
      }
      placeholder="e.g. 30"
      className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
      style={{
        background: "var(--input-background)",
        borderColor: "var(--border)",
        color: "var(--foreground)",
      }}
    />
  </div>

</div>

                <div>
                  <label className="text-sm font-semibold text-foreground mb-1.5 block">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((a) => ({ ...a, status: e.target.value }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                  >
                    <option value="upcoming">Upcoming</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="flex-1 py-2.5 rounded-xl border text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                Cancel
              </button>

              <button
                onClick={saveActivity}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ background: "var(--primary)" }}
              >
                {editing ? "Save Changes" : "Create Activity"}
              </button>
            </div>
          </div>
        
      )}
    </div>
  );
}