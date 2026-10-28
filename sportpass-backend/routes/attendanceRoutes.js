const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAdmin, selfOrAdmin } = require("../middleware/auth");
const {
  finePerScan,
  settle,
  PAID_FOR_DAY,
  NOTE_FOR_DAY,
  DAY_IS_OVER,
  DAY_NAME,
  attendanceFineAmount,
} = require("../lib/fines");
const settings = require("../lib/settings");
const { offlineScan, verifyOptionsFor } = require("../lib/offlineScans");

const router = express.Router();

/*
 * Attendance is taken once per sportfest day. The officers choose which
 * dates are sportfest days (Sportfest Days page); each student gets one
 * time-in and one time-out per day.
 */

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
// "17:00" or "17:00:00" -> "17:00:00"; "" / null -> null (no closing time).
function readClosingTime(v) {
  if (v === undefined) return { skip: true };
  if (v === null || v === "") return { value: null };
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(String(v));
  if (!m) return { error: "Enter the closing time as HH:MM, e.g. 17:00." };
  return { value: `${m[1]}:${m[2]}:${m[3] || "00"}` };
}
const formatClock = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/* ---------------------------------------------------------------------
 * Sportfest days
 * ------------------------------------------------------------------- */

/* Any logged-in user: the list of sportfest days. */
router.get("/days", (req, res) => {
  const sql = `
    SELECT
      sd.day_id,
      sd.sportfest_date,
      DATE_FORMAT(sd.sportfest_date, '%Y-%m-%d') AS date_key,
      sd.title,
      sd.status,
      DATE_FORMAT(sd.closes_at, '%H:%i') AS closes_at,
      sd.sportfest_date = CURDATE() AS is_today,
      ${DAY_IS_OVER} AS is_over,
      (SELECT COUNT(*) FROM daily_attendance d
        WHERE d.day_id = sd.day_id AND d.time_in IS NOT NULL) AS present,
      (SELECT COUNT(*) FROM daily_attendance d
        WHERE d.day_id = sd.day_id) AS records,
      (SELECT COUNT(*) FROM activities a
        WHERE a.activity_date = sd.sportfest_date) AS activities
    FROM sportfest_days sd
    ORDER BY sd.sportfest_date ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error." });
    }
    res.json(rows);
  });
});

/* ADMIN: make a date a sportfest day. */
router.post("/days", requireAdmin, (req, res) => {
  const { sportfest_date, title, notify } = req.body;
  const closing = readClosingTime(req.body.closes_at);

  if (!isDate(sportfest_date)) {
    return res.status(400).json({ message: "Choose a date for the sportfest day." });
  }
  if (closing.error) return res.status(400).json({ message: closing.error });
  if (title && String(title).length > 150) {
    return res.status(400).json({ message: "The title is too long." });
  }

  // Only today or later: a past day would instantly mark every student
  // absent and fine them.
  db.query("SELECT ? < CURDATE() AS is_past", [sportfest_date], (pastErr, pastRows) => {
  if (pastErr) return res.status(500).json({ message: "Database error." });
  if (Number(pastRows[0].is_past)) {
    return res.status(400).json({ message: "Pick today or a future date. Past dates can't become sportfest days." });
  }

  db.query(
    "INSERT INTO sportfest_days (sportfest_date, title, closes_at, created_by) VALUES (?, ?, ?, ?)",
    [sportfest_date, title ? String(title).trim() : null, closing.value ?? null, req.user.user_id],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "That date is already a sportfest day." });
        }
        console.error(err);
        return res.status(500).json({ message: "Failed to add the sportfest day." });
      }

      // Tell students, unless the admin unticked "Notify students".
      if (notify !== false) {
        const label = new Date(`${sportfest_date}T00:00:00`).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        db.query(
          `INSERT INTO notifications (title, message, type, recipient_role, created_by)
           VALUES (?, ?, 'activity', 'student', ?)`,
          [
            title ? `Sportfest day: ${String(title).trim()}` : "Sportfest day announced",
            `${label} is a sportfest day. Show your QR code to an officer for time-in when you arrive and time-out when you leave.` +
              (closing.value ? ` Attendance closes at ${formatClock(closing.value)}.` : ""),
            req.user.user_id,
          ],
          (nErr) => {
            if (nErr) console.log("Sportfest day notification not sent:", nErr.message);
          }
        );
      }

      res.json({ message: "Sportfest day added.", day_id: result.insertId });
    }
  );
  });
});

/* ADMIN: rename a day, or close / reopen it.
 * Closing a day makes its fines final before the date has passed. */
router.put("/days/:day_id", requireAdmin, (req, res) => {
  const sets = [];
  const params = [];

  if (req.body.title !== undefined) {
    if (String(req.body.title).length > 150) {
      return res.status(400).json({ message: "The title is too long." });
    }
    sets.push("title = ?");
    params.push(String(req.body.title).trim() || null);
  }
  if (req.body.status !== undefined) {
    if (!["open", "closed"].includes(req.body.status)) {
      return res.status(400).json({ message: "Status must be open or closed." });
    }
    sets.push("status = ?");
    params.push(req.body.status);
  }
  const closing = readClosingTime(req.body.closes_at);
  if (closing.error) return res.status(400).json({ message: closing.error });
  if (!closing.skip) {
    sets.push("closes_at = ?");
    params.push(closing.value);
  }
  if (sets.length === 0) return res.status(400).json({ message: "Nothing to change." });

  params.push(req.params.day_id);
  db.query(`UPDATE sportfest_days SET ${sets.join(", ")} WHERE day_id = ?`, params, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to update the sportfest day." });
    }
    if (result.affectedRows === 0) return res.status(404).json({ message: "Sportfest day not found." });
    res.json({ message: "Sportfest day updated." });
  });
});

/* ADMIN: remove a sportfest day that has no attendance yet. */
router.delete("/days/:day_id", requireAdmin, (req, res) => {
  db.query(
    "SELECT COUNT(*) AS records FROM daily_attendance WHERE day_id = ?",
    [req.params.day_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error." });
      if (Number(rows[0].records) > 0) {
        return res.status(400).json({
          message: "Students were already scanned on this day, so it can't be removed. Close it instead.",
        });
      }
      db.query("DELETE FROM sportfest_days WHERE day_id = ?", [req.params.day_id], (delErr, result) => {
        if (delErr) return res.status(500).json({ message: "Failed to remove the sportfest day." });
        if (result.affectedRows === 0) return res.status(404).json({ message: "Sportfest day not found." });

        // Optional announcement to students that the day was cancelled.
        const body = req.body || {};
        const title = String(body.announce_title || "").trim().slice(0, 150);
        const message = String(body.announce_message || "").trim().slice(0, 2000);
        if (body.notify && title && message) {
          return db.query(
            `INSERT INTO notifications (title, message, type, recipient_role, created_by)
             VALUES (?, ?, 'alert', 'student', ?)`,
            [title, message, req.user.user_id],
            (nErr) => {
              if (nErr) console.log("Cancellation notice not sent:", nErr.message);
              res.json({
                message: nErr
                  ? "Sportfest day removed, but the announcement could not be sent."
                  : "Sportfest day removed. Students have been notified.",
                notified: !nErr,
              });
            }
          );
        }
        res.json({ message: "Sportfest day removed." });
      });
    }
  );
});

/* ---------------------------------------------------------------------
 * Attendance
 * ------------------------------------------------------------------- */

/* A student's own attendance history (admins: anyone's). */
router.get("/history/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const sql = `
    SELECT
      d.attendance_id,
      sd.day_id,
      sd.sportfest_date AS attendance_date,
      d.time_in,
      d.time_out,
      ${DAY_NAME} AS activity_name,
      'Sportfest Day' AS sport_name,
      '' AS activity_location,
      IF(d.payment_status = 'paid', 1, 0) AS legacy_paid,
      ${PAID_FOR_DAY("s.student_id", "sd.day_id")} AS paid_raw,
      ${NOTE_FOR_DAY("s.student_id", "sd.day_id")} AS payment_note,
      -- Same rules as lib/fines.js (dashboard, My Fines, Fine Monitoring):
      -- a day with no record at all is an absence (2 missed scans).
      CASE
        WHEN d.attendance_id IS NULL THEN ${finePerScan() * 2}
        ELSE ${attendanceFineAmount("d")}
      END AS fine,
      ${DAY_IS_OVER} AS fine_final
    FROM students s
    JOIN users u ON u.user_id = s.user_id
    CROSS JOIN sportfest_days sd
    LEFT JOIN daily_attendance d
      ON d.student_id = s.student_id AND d.day_id = sd.day_id
    WHERE s.student_id = ?
      AND sd.sportfest_date <= CURDATE()
      AND (d.attendance_id IS NOT NULL OR DATE(u.created_at) <= sd.sportfest_date)
    ORDER BY sd.sportfest_date DESC
  `;

  db.query(sql, [req.params.student_id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error." });
    res.json(rows.map((r) => settle(r, "fine")));
  });
});

/* ADMIN: every student's attendance and fine for one sportfest day. */
router.get("/day/:day_id", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      s.student_id,
      s.first_name,
      s.last_name,
      s.year_level,
      s.section,
      s.gender,

      d.attendance_id,
      sd.day_id,
      sd.sportfest_date AS attendance_date,
      d.time_in,
      d.time_out,
      IF(d.payment_status = 'paid', 1, 0) AS legacy_paid,
      ${PAID_FOR_DAY("s.student_id", "sd.day_id")} AS paid_raw,
      ${NOTE_FOR_DAY("s.student_id", "sd.day_id")} AS payment_note,

      CASE
        WHEN d.attendance_id IS NULL THEN 'absent'
        WHEN d.time_in IS NOT NULL AND d.time_out IS NOT NULL THEN 'complete'
        WHEN d.time_in IS NOT NULL AND d.time_out IS NULL THEN 'no-time-out'
        ELSE 'incomplete'
      END AS attendance_status,

      -- Same rules as lib/fines.js. Computed live from the day's scans;
      -- fine_final says whether the day is over (closed or past), which is
      -- when the fine becomes official and can be marked paid.
      CASE
        WHEN sd.sportfest_date > CURDATE() THEN 0
        WHEN d.attendance_id IS NULL THEN
          IF(DATE(u.created_at) <= sd.sportfest_date, ${finePerScan() * 2}, 0)
        ELSE ${attendanceFineAmount("d")}
      END AS fine,
      ${DAY_IS_OVER} AS fine_final
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    CROSS JOIN (SELECT * FROM sportfest_days WHERE day_id = ?) sd
    LEFT JOIN daily_attendance d
      ON s.student_id = d.student_id
      AND d.day_id = sd.day_id
    ORDER BY s.last_name ASC, s.first_name ASC
  `;

  db.query(sql, [req.params.day_id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error." });
    }
    res.json(results.map((r) => settle(r, "fine")));
  });
});

/* ADMIN (officers): scan a student's QR code on a sportfest day.
 * First scan = time-in, second = time-out. */
router.post("/scan", requireAdmin, offlineScan("attendance"), (req, res) => {
  const { token, day_id } = req.body;
  // Saved offline: use the time it was scanned, not the time it arrived.
  const scan = req.scan;
  const scanTime = scan.offline ? scan.at : null;

  if (!token || !day_id) {
    return res.status(400).json({ message: "Missing QR token or sportfest day." });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, verifyOptionsFor(scan));
  } catch {
    return res.status(400).json({
      message: scan.offline
        ? "This saved scan's QR code had already expired when it was scanned."
        : "QR code expired or invalid. Ask the student to refresh their QR.",
    });
  }

  if (decoded.type !== "SPORTPASS_ATTENDANCE_QR") {
    return res.status(400).json({ message: "Invalid attendance QR code." });
  }

  const student_id = decoded.student_id;
  const name = decoded.full_name || student_id;

  db.query(
    `SELECT sportfest_date = DATE(COALESCE(?, NOW())) AS is_today, status,
            closes_at IS NOT NULL AND TIME(COALESCE(?, NOW())) >= closes_at AS after_closing,
            DATE_FORMAT(closes_at, '%H:%i') AS closes_at
     FROM sportfest_days WHERE day_id = ?`,
    [scanTime, scanTime, day_id],
    (dayErr, days) => {
      if (dayErr) return res.status(500).json({ message: "Database error." });
      if (days.length === 0) return res.status(404).json({ message: "Sportfest day not found." });
      if (!Number(days[0].is_today)) {
        return res.status(400).json({
          message: "Attendance can only be scanned on the sportfest day itself.",
        });
      }
      // A scan saved offline while the day was open still counts if the day
      // was closed before the phone got back online.
      if (days[0].status === "closed" && !scan.offline) {
        return res.status(400).json({ message: "This sportfest day is closed." });
      }
      if (Number(days[0].after_closing)) {
        return res.status(400).json({
          message: `Attendance for this day closed at ${formatClock(days[0].closes_at)}.`,
        });
      }

      db.query(
        `SELECT attendance_id, time_in, time_out,
                TIMESTAMPDIFF(SECOND, time_in, COALESCE(?, NOW())) AS seconds_since_time_in
         FROM daily_attendance WHERE student_id = ? AND day_id = ?`,
        [scanTime, student_id, day_id],
        (err, rows) => {
          if (err) return res.status(500).json({ message: "Database error." });

          if (rows.length === 0) {
            return db.query(
              "INSERT INTO daily_attendance (student_id, day_id, time_in) VALUES (?, ?, COALESCE(?, NOW()))",
              [student_id, day_id, scanTime],
              (insertErr) => {
                if (insertErr) {
                  if (insertErr.code === "ER_DUP_ENTRY") {
                    return res.status(400).json({ message: `${name} was just timed in.` });
                  }
                  console.log("TIME-IN INSERT ERROR:", insertErr);
                  return res.status(500).json({ message: "Failed to record time-in." });
                }
                res.json({ action: "time_in", message: "Time-in recorded successfully.", student_id, full_name: decoded.full_name });
              }
            );
          }

          const record = rows[0];

          if (record.time_out) {
            return res.status(400).json({
              message: `${name} already has a time-in and time-out for today.`,
            });
          }

          // Refuse a time-out that comes too soon after time-in, so scanning
          // the same student twice by accident doesn't end their day.
          if (record.seconds_since_time_in !== null && record.seconds_since_time_in < 0) {
            return res.status(400).json({
              message: `${name}'s saved scan is earlier than the time-in already recorded, so it was skipped.`,
            });
          }

          const minMinutes = Number(settings.get("min_minutes_before_time_out")) || 0;
          if (
            record.seconds_since_time_in !== null &&
            record.seconds_since_time_in < minMinutes * 60
          ) {
            return res.status(400).json({
              message: `${name} was just timed in. Time-out can be recorded after ${minMinutes} minute(s).`,
            });
          }

          db.query(
            "UPDATE daily_attendance SET time_out = COALESCE(?, NOW()) WHERE attendance_id = ?",
            [scanTime, record.attendance_id],
            (updateErr) => {
              if (updateErr) return res.status(500).json({ message: "Failed to record time-out." });
              res.json({ action: "time_out", message: "Time-out recorded successfully.", student_id, full_name: decoded.full_name });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
