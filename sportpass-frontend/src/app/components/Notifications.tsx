import { useEffect, useState } from "react";
import { Bell, Plus } from "lucide-react";
import { apiFetch } from "../lib/api";

interface NotificationItem {
  notification_id: number;
  title: string;
  message: string;
  type: string;
  recipient_role: string;
  created_at: string;
  is_read?: number;
}

const typeColor: Record<string, string> = {
  activity: "#2563EB",
  ranking: "#F59E0B",
  badge: "#8B5CF6",
  reminder: "#10B981",
  alert: "#EF4444",
  system: "#6B7280",
};

const typeIcon: Record<string, string> = {
  activity: "📅",
  ranking: "🏆",
  badge: "⭐",
  reminder: "⏰",
  alert: "⚠️",
  system: "🔧",
};

const recipientLabel: Record<string, string> = {
  all: "Everyone",
  student: "Students",
  admin: "Administrators",
};

function timeAgo(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const inputStyle = {
  background: "var(--input-background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};

export function Notifications() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAdmin = user.role === "admin";

  const [filter, setFilter] = useState("all");
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({
    recipient_role: "student",
    title: "",
    message: "",
    type: "activity",
  });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    try {
      setError("");
      const response = await apiFetch(
        isAdmin ? "/api/notifications" : `/api/notifications/${user.student_id}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to load notifications.");
        return;
      }

      setNotifs(Array.isArray(data) ? data : []);
    } catch {
      setError("Cannot connect to server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Admins see what they've sent; read status only applies to students.
  const isRead = (n: NotificationItem) => isAdmin || Number(n.is_read) === 1;

  const unread = notifs.filter((n) => !isRead(n)).length;
  const filtered = notifs.filter(
    (n) =>
      filter === "all" ||
      (filter === "unread" ? !isRead(n) : n.type === filter)
  );

  const markRead = async (n: NotificationItem) => {
    if (isRead(n)) return;

    setNotifs((ns) =>
      ns.map((x) =>
        x.notification_id === n.notification_id ? { ...x, is_read: 1 } : x
      )
    );

    await apiFetch(`/api/notifications/read/${n.notification_id}`, {
      method: "PUT",
    }).catch(() => {});
  };

  const markAll = async () => {
    setNotifs((ns) => ns.map((x) => ({ ...x, is_read: 1 })));

    await apiFetch(`/api/notifications/read-all/${user.student_id}`, {
      method: "PUT",
    }).catch(() => {});
  };

  const send = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      setFormError("Enter a title and a message.");
      return;
    }

    try {
      setSending(true);
      setFormError("");

      const response = await apiFetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          message: form.message.trim(),
          created_by: user.user_id || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.message || "Failed to send notification.");
        return;
      }

      setShowCompose(false);
      setForm({ recipient_role: "student", title: "", message: "", type: "activity" });
      load();
    } catch {
      setFormError("Cannot connect to server.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="font-heading font-bold text-foreground text-xl">Notifications</h2>
            {unread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>{unread} new</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {isAdmin
              ? "Send announcements, schedules and reminders to students"
              : "Stay updated on activities, rankings, and alerts"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isAdmin && unread > 0 && (
            <button onClick={markAll} className="px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-all" style={{ borderColor: "var(--border)", color: "var(--foreground)" }}>
              Mark all read
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowCompose(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-bold hover:opacity-90" style={{ background: "var(--primary)" }}>
              <Plus size={15} /> Send Notification
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All" },
          ...(isAdmin ? [] : [{ key: "unread", label: `Unread (${unread})` }]),
          { key: "activity", label: "Activities" },
          { key: "reminder", label: "Reminders" },
          { key: "ranking", label: "Rankings" },
          { key: "alert", label: "Alerts" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filter === f.key ? "text-white" : "text-muted-foreground border hover:text-foreground"}`}
            style={filter === f.key ? { background: "var(--primary)" } : { borderColor: "var(--border)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading notifications...</div>
      ) : error ? (
        <div className="text-center py-16 text-sm" style={{ color: "#EF4444" }}>{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {notifs.length === 0
            ? isAdmin
              ? "No notifications sent yet. Use Send Notification to post the first one."
              : "No notifications yet."
            : "No notifications match this filter."}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => {
            const read = isRead(n);
            const color = typeColor[n.type] || typeColor.system;
            return (
              <div
                key={n.notification_id}
                onClick={() => markRead(n)}
                className={`rounded-2xl p-5 border transition-all hover:shadow-md ${!read ? "border-l-4 cursor-pointer" : ""}`}
                style={{
                  background: "var(--card)",
                  borderColor: read ? "var(--border)" : color,
                  borderLeftColor: !read ? color : undefined,
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: color + "15" }}>
                    {typeIcon[n.type] || typeIcon.system}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm text-foreground ${!read ? "font-bold" : "font-semibold"}`}>{n.title}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{n.message}</p>
                    {isAdmin && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Sent to: {recipientLabel[n.recipient_role] || n.recipient_role}
                      </p>
                    )}
                  </div>
                  {!read && (
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1" style={{ background: color }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose modal (admins only) */}
      {isAdmin && showCompose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="w-full max-w-md rounded-2xl p-5 sm:p-6 max-h-[90dvh] overflow-y-auto" style={{ background: "var(--card)" }}>
            <div className="flex items-center gap-3 mb-5">
              <Bell size={18} style={{ color: "var(--primary)" }} />
              <h3 className="font-heading font-bold text-foreground">Send Notification</h3>
              <button onClick={() => setShowCompose(false)} className="ml-auto text-muted-foreground hover:text-foreground">×</button>
            </div>
            <div className="space-y-3">
              <div>
                <label htmlFor="notif-recipients" className="text-sm font-semibold text-foreground mb-1.5 block">Recipients</label>
                <select id="notif-recipients" value={form.recipient_role} onChange={(e) => setForm({ ...form, recipient_role: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle}>
                  <option value="student">All students</option>
                  <option value="all">Everyone (students and administrators)</option>
                  <option value="admin">Administrators only</option>
                </select>
              </div>
              <div>
                <label htmlFor="notif-title" className="text-sm font-semibold text-foreground mb-1.5 block">Title</label>
                <input id="notif-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Basketball finals moved to 3 PM" className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="notif-message" className="text-sm font-semibold text-foreground mb-1.5 block">Message</label>
                <textarea id="notif-message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={3} placeholder="Write your message..." className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div>
                <label htmlFor="notif-type" className="text-sm font-semibold text-foreground mb-1.5 block">Type</label>
                <select id="notif-type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border text-sm outline-none" style={inputStyle}>
                  <option value="activity">Activity / schedule update</option>
                  <option value="reminder">Reminder</option>
                  <option value="ranking">Ranking update</option>
                  <option value="alert">Alert</option>
                  <option value="system">System</option>
                </select>
              </div>
              {formError && <p className="text-sm" style={{ color: "#EF4444" }}>{formError}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCompose(false)} className="flex-1 py-2.5 rounded-xl border text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Cancel</button>
              <button onClick={send} disabled={sending} className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-60" style={{ background: "var(--primary)" }}>
                {sending ? "Sending..." : "Send Now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
