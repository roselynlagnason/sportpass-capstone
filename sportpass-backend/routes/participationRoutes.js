const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireStudent, selfOrAdmin } = require("../middleware/auth");
const { offlineScan, verifyOptionsFor } = require("../lib/offlineScans");

const router = express.Router();

// A student scans the activity's QR. The student is always the logged-in
// user (any student_id in the body is ignored), and points are only given
// to students who were timed in to that activity by an officer.
router.post("/scan", requireStudent, offlineScan("participation"), (req, res) => {
  const { token } = req.body;
  const student_id = req.user.student_id;
  // Saved offline: use the time it was scanned, not the time it arrived.
  const scan = req.scan;
  const scanTime = scan.offline ? scan.at : null;

  if (!token) {
    return res.status(400).json({ message: "Missing QR data" });
  }

  try {
    const qrData = jwt.verify(token, process.env.JWT_SECRET, verifyOptionsFor(scan));

    if (qrData.type !== "SPORTPASS_ACTIVITY_QR") {
      return res.status(400).json({ message: "Invalid activity QR" });
    }

    const { activity_id, qr_type } = qrData;

    if (!["participation", "accomplishment"].includes(qr_type)) {
      return res.status(400).json({ message: "Invalid QR type" });
    }

    const getActivitySql = `
      SELECT activity_id, participation_points, accomplishment_points
      FROM activities
      WHERE activity_id = ?
    `;

    db.query(getActivitySql, [activity_id], (err, activityRows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (activityRows.length === 0) {
        return res.status(404).json({ message: "Activity not found" });
      }

      const activity = activityRows[0];

      // Timed in on the sportfest day of this activity's date.
      const attendedSql = `
        SELECT d.attendance_id
        FROM daily_attendance d
        JOIN sportfest_days sd ON sd.day_id = d.day_id
        JOIN activities a ON a.activity_date = sd.sportfest_date
        WHERE d.student_id = ? AND a.activity_id = ? AND d.time_in IS NOT NULL
        LIMIT 1
      `;

      db.query(attendedSql, [student_id, activity_id], (attErr, attRows) => {
      if (attErr) {
        console.error(attErr);
        return res.status(500).json({ message: "Database error" });
      }

      if (attRows.length === 0) {
        // Saved offline: the officer's time-in may still be waiting on their
        // phone, so let the student's phone try again later.
        if (scan.offline) {
          return res.status(409).json({
            retry: true,
            message:
              "Waiting for your time-in to reach the server. This scan will be sent again automatically.",
          });
        }
        return res.status(403).json({
          message:
            "You need to be timed in for today's sportfest before you can earn points. Ask an officer to scan your QR code.",
        });
      }

      const checkSql = `
        SELECT *
        FROM participation_records
        WHERE student_id = ? AND activity_id = ?
      `;

      db.query(checkSql, [student_id, activity_id], (checkErr, rows) => {
        if (checkErr) {
          console.error(checkErr);
          return res.status(500).json({ message: "Database error" });
        }

        const isParticipation = qr_type === "participation";

        if (rows.length === 0) {
          const insertSql = `
            INSERT INTO participation_records
            (
              student_id,
              activity_id,
              participation_status,
              participation_points,
              accomplishment_status,
              accomplishment_points,
              participated_at,
              accomplished_at
            )
            VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, NOW()), COALESCE(?, NOW()))
          `;

          db.query(
            insertSql,
            [
              student_id,
              activity_id,
              isParticipation ? "participated" : "not_participated",
              isParticipation ? activity.participation_points : 0,
              isParticipation ? "not_accomplished" : "accomplished",
              isParticipation ? 0 : activity.accomplishment_points,
              scanTime,
              scanTime,
            ],
            (insertErr) => {
              if (insertErr) {
                console.error(insertErr);
                return res.status(500).json({ message: "Scan failed" });
              }

              return res.json({
                message: isParticipation
                  ? "Participation points added successfully"
                  : "Accomplishment points added successfully",
              });
            }
          );
        } else {
          const existing = rows[0];

          if (isParticipation && existing.participation_status === "participated") {
            return res.status(400).json({ message: "Participation already recorded" });
          }

          if (!isParticipation && existing.accomplishment_status === "accomplished") {
            return res.status(400).json({ message: "Accomplishment already recorded" });
          }

          const updateSql = isParticipation
            ? `
              UPDATE participation_records
              SET participation_status = 'participated',
                  participation_points = ?,
                  participated_at = COALESCE(?, NOW())
              WHERE student_id = ? AND activity_id = ?
            `
            : `
              UPDATE participation_records
              SET accomplishment_status = 'accomplished',
                  accomplishment_points = ?,
                  accomplished_at = COALESCE(?, NOW())
              WHERE student_id = ? AND activity_id = ?
            `;

          const points = isParticipation
            ? activity.participation_points
            : activity.accomplishment_points;

          db.query(updateSql, [points, scanTime, student_id, activity_id], (updateErr) => {
            if (updateErr) {
              console.error(updateErr);
              return res.status(500).json({ message: "Update failed" });
            }

            return res.json({
              message: isParticipation
                ? "Participation points added successfully"
                : "Accomplishment points added successfully",
            });
          });
        }
      });
      });
    });
  } catch (err) {
    return res.status(400).json({
      message: req.scan && req.scan.offline
        ? "This saved scan's QR code had already expired when it was scanned."
        : "Invalid or expired QR code. Ask the officer to show the current code.",
    });
  }
});


router.get("/student/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { student_id } = req.params;

  const sql = `
    SELECT
      pr.participation_id,
      pr.activity_id,
      pr.participation_status,
      pr.participation_points,
      pr.accomplishment_status,
      pr.accomplishment_points,
      pr.participated_at,
      pr.accomplished_at,
      a.sport_name,
      a.activity_name,
      a.activity_date,
      a.activity_location
    FROM participation_records pr
    JOIN activities a ON pr.activity_id = a.activity_id
    WHERE pr.student_id = ?
  `;

  db.query(sql, [student_id], (err, results) => {
    if (err) {
      console.error("Participation history error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const formatted = [];

    results.forEach((r) => {
      if (r.participation_status === "participated") {
        formatted.push({
          participation_id: `${r.participation_id}-participation`,
          activity_id: r.activity_id,
          participation_type: "participation",
          points_earned: Number(r.participation_points || 0),
          created_at: r.participated_at,
          sport_name: r.sport_name,
          activity_name: r.activity_name,
          activity_date: r.activity_date,
          activity_location: r.activity_location,
        });
      }

      if (r.accomplishment_status === "accomplished") {
        formatted.push({
          participation_id: `${r.participation_id}-accomplishment`,
          activity_id: r.activity_id,
          participation_type: "accomplishment",
          points_earned: Number(r.accomplishment_points || 0),
          created_at: r.accomplished_at,
          sport_name: r.sport_name,
          activity_name: r.activity_name,
          activity_date: r.activity_date,
          activity_location: r.activity_location,
        });
      }
    });

    formatted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(formatted);
  });
});

module.exports = router;