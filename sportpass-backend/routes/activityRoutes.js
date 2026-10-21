const express = require("express");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

const settings = require("../lib/settings");

// Activity QR codes are short-lived and refresh on the admin's screen,
// so a photo of the code stops working quickly. The lifetime is set on
// the Settings page ("Activity QR code lifetime").
const qrTtl = () => Number(settings.get("activity_qr_ttl_seconds")) || 120;

// Tells students about a new or changed activity, if that is switched on
// in Settings ("Notify students about activity changes").
function notifyStudents(title, message, createdBy) {
  if (!settings.get("notify_on_activity_change")) return;
  db.query(
    `INSERT INTO notifications (title, message, type, recipient_role, created_by)
     VALUES (?, ?, 'activity', 'student', ?)`,
    [title, message, createdBy || null],
    (err) => {
      if (err) console.log("Activity notification not sent:", err.message);
    }
  );
}

function describe(a) {
  const when = [a.activity_date, a.activity_time].filter(Boolean).join(" ");
  return `${a.sport_name} – ${a.activity_name}${when ? `, ${when}` : ""}${
    a.activity_location ? ` at ${a.activity_location}` : ""
  }.`;
}

function generateActivityQR(activity_id, qr_type) {
  return jwt.sign(
    {
      type: "SPORTPASS_ACTIVITY_QR",
      activity_id,
      qr_type,
    },
    process.env.JWT_SECRET,
    { expiresIn: qrTtl() }
  );
}

router.get("/", (req, res) => {
  const sql = `
    SELECT *
    FROM activities
    ORDER BY activity_date ASC, activity_time ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database Error" });
    res.json(results);
  });
});

// Activities happen on sportfest days: students earn points only if they
// were timed in that day, so an activity on any other date would be
// impossible to score.
function requireSportfestDay(req, res, next) {
  const date = String(req.body.activity_date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ message: "Choose the sportfest day for this activity." });
  }
  db.query(
    "SELECT day_id FROM sportfest_days WHERE sportfest_date = ?",
    [date],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (rows.length === 0) {
        return res.status(400).json({
          message: `${date} is not a sportfest day. Add it on the Sportfest Days page first.`,
        });
      }
      next();
    }
  );
}

router.post("/", requireAdmin, requireSportfestDay, (req, res) => {
  const {
    sport_name,
    activity_name,
    activity_date,
    activity_time,
    activity_location,
    participation_requirement,
    participation_points,
    accomplishment_points,
  } = req.body;
  const created_by = req.user.user_id;

  const sql = `
    INSERT INTO activities
    (
      sport_name,
      activity_name,
      activity_date,
      activity_time,
      activity_location,
      participation_requirement,
      participation_points,
      accomplishment_points,
      created_by
    )
    VALUES (?,?,?,?,?,?,?,?,?)
  `;

  db.query(
    sql,
    [
      sport_name,
      activity_name,
      activity_date,
      activity_time,
      activity_location,
      participation_requirement || null,
      participation_points,
      accomplishment_points,
      created_by || null,
    ],
    (err, result) => {
      if (err) return res.status(500).json({ message: "Unable to create activity" });

      const activityId = result.insertId;

      const participationToken = generateActivityQR(activityId, "participation");
      const accomplishmentToken = generateActivityQR(activityId, "accomplishment");

      const qrSql = `
        INSERT INTO activity_qr_codes
        (activity_id, qr_type, qr_token, points, expires_at)
        VALUES
        (?, 'participation', ?, ?, DATE_ADD(NOW(), INTERVAL ${qrTtl()} SECOND)),
        (?, 'accomplishment', ?, ?, DATE_ADD(NOW(), INTERVAL ${qrTtl()} SECOND))
      `;

      db.query(
        qrSql,
        [
          activityId,
          participationToken,
          participation_points,
          activityId,
          accomplishmentToken,
          accomplishment_points,
        ],
        (qrErr) => {
          if (qrErr) {
            return res.status(500).json({
              message: "Activity created but QR generation failed",
            });
          }

          notifyStudents(
            "New activity scheduled",
            describe(req.body),
            created_by
          );

          res.json({ message: "Activity and QR codes created successfully" });
        }
      );
    }
  );
});

// Returns freshly signed QR codes every time it is called. The admin's
// screen calls it again before the codes expire.
router.get("/:id/qrcodes", requireAdmin, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT activity_id, sport_name, activity_name,
           participation_points, accomplishment_points
    FROM activities
    WHERE activity_id = ?
  `;

  db.query(sql, [id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Unable to fetch QR codes" });
    if (rows.length === 0) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const a = rows[0];
    const ttl = qrTtl();
    const expiresAt = new Date(Date.now() + ttl * 1000);

    res.json(
      ["participation", "accomplishment"].map((qr_type) => ({
        activity_id: a.activity_id,
        qr_type,
        qr_token: generateActivityQR(a.activity_id, qr_type),
        points:
          qr_type === "participation"
            ? a.participation_points
            : a.accomplishment_points,
        expires_at: expiresAt,
        expires_in: ttl,
        sport_name: a.sport_name,
        activity_name: a.activity_name,
        participation_points: a.participation_points,
        accomplishment_points: a.accomplishment_points,
      }))
    );
  });
});

router.put("/:id", requireAdmin, requireSportfestDay, (req, res) => {
  const { id } = req.params;

  const {
    sport_name,
    activity_name,
    activity_date,
    activity_time,
    activity_location,
    participation_requirement,
    participation_points,
    accomplishment_points,
    status,
  } = req.body;

  const sql = `
    UPDATE activities
    SET
      sport_name=?,
      activity_name=?,
      activity_date=?,
      activity_time=?,
      activity_location=?,
      participation_requirement=?,
      participation_points=?,
      accomplishment_points=?,
      status=?
    WHERE activity_id=?
  `;

  db.query(
    sql,
    [
      sport_name,
      activity_name,
      activity_date,
      activity_time,
      activity_location,
      participation_requirement || null,
      participation_points,
      accomplishment_points,
      status,
      id,
    ],
    (err) => {
      if (err) return res.status(500).json({ message: "Unable to update activity" });

      notifyStudents(
        status === "completed" ? "Activity completed" : "Activity updated",
        describe(req.body),
        req.user.user_id
      );

      res.json({ message: "Activity updated successfully" });
    }
  );
});

router.delete("/:id", requireAdmin, (req, res) => {
  const { id } = req.params;

  // Activities with attendance or points recorded are kept, so the
  // sportfest history and fines stay complete.
  const historySql = `
    SELECT
      (SELECT COUNT(*) FROM attendance WHERE activity_id = ?) +
      (SELECT COUNT(*) FROM participation_records WHERE activity_id = ?) AS records
  `;

  db.query(historySql, [id, id], (histErr, histRows) => {
    if (histErr) return res.status(500).json({ message: "Unable to delete activity" });

    if (Number(histRows[0].records) > 0) {
      return res.status(400).json({
        message:
          "This activity already has attendance or points recorded, so it can't be deleted. Mark it completed instead.",
      });
    }

    db.query("DELETE FROM activity_qr_codes WHERE activity_id=?", [id], () => {
      db.query("DELETE FROM activities WHERE activity_id=?", [id], (err, result) => {
        if (err) return res.status(500).json({ message: "Unable to delete activity" });
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Activity not found" });
        }
        res.json({ message: "Activity deleted successfully" });
      });
    });
  });
});

module.exports = router;