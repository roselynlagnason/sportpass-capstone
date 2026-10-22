require("dotenv").config();
// Philippine time for dates the server formats (e.g. notification text).
// Cloud servers run on UTC otherwise.
process.env.TZ = process.env.APP_TIMEZONE || "Asia/Manila";

// Logins and QR codes are signed with JWT_SECRET; without it every login
// fails. Stop here with a clear message instead.
if (!process.env.JWT_SECRET) {
  console.error(
    "JWT_SECRET is not set. Add it to sportpass-backend/.env (or the hosting\n" +
      "service's environment variables). Make one with:\n" +
      "  node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
  );
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const { requireAuth } = require("./middleware/auth");

const authRoutes = require("./routes/authRoutes");
const activityRoutes = require("./routes/activityRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const participationRoutes = require("./routes/participationRoutes");
const passportRoutes = require("./routes/passportRoutes");
const rankingRoutes = require("./routes/rankingRoutes");
const fineRoutes = require("./routes/fineRoutes");
const reportRoutes = require("./routes/reportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const adminDashboardRoutes = require("./routes/adminDashboardRoutes");
const studentDashboardRoutes = require("./routes/studentDashboardRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const db = require("./db");
const settings = require("./lib/settings");
const migrate = require("./lib/migrate");
const { servePhoto, copyDiskPhotosToDatabase } = require("./lib/photos");

const app = express();

// Which websites may call this API. Set CORS_ORIGIN to your Vercel address
// (several addresses separated by commas). Unset = allow all, for local use.
const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length
      ? {
          origin: (origin, cb) =>
            !origin || allowedOrigins.includes(origin)
              ? cb(null, true)
              : cb(null, false),
        }
      : undefined
  )
);
app.use(express.json());

// Profile photos: from the database first, then the uploads folder (older
// photos). nosniff stops browsers from treating an upload as a web page.
app.get("/uploads/:name", servePhoto(db));
app.use(
  "/uploads",
  express.static("uploads", {
    setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff"),
  })
);

app.use("/api/auth", authRoutes);
// Everything below requires a logged-in user. Admin-only and
// own-records-only checks are applied inside each route file.
app.use("/api/activities", requireAuth, activityRoutes);
app.use("/api/attendance", requireAuth, attendanceRoutes);
app.use("/api/participation", requireAuth, participationRoutes);
app.use("/api/passport", requireAuth, passportRoutes);
app.use("/api/rankings", requireAuth, rankingRoutes);
app.use("/api/fines", requireAuth, fineRoutes);
app.use("/api/reports", requireAuth, reportRoutes);
app.use("/api/notifications", requireAuth, notificationRoutes);
app.use("/api/admin/dashboard", requireAuth, adminDashboardRoutes);
app.use("/api/student/dashboard", requireAuth, studentDashboardRoutes);
app.use("/api/settings", requireAuth, settingsRoutes);


app.get("/", (req, res) => {
    res.send("SPORTPASS Backend Running");
});

// Apply database updates, then load saved settings.
migrate(db, () => {
  settings.load(db);
  copyDiskPhotosToDatabase(db);
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});