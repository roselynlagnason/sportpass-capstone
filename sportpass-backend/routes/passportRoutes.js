const express = require("express");
const db = require("../db");
const { selfOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { student_id } = req.params;

  const sql = `
    SELECT
      a.activity_id,
      a.sport_name,
      a.activity_name,
      a.activity_date,
      a.activity_location,
      a.participation_points AS possible_participation_points,
      a.accomplishment_points AS possible_accomplishment_points,

      at.time_in,
      at.time_out,
      CASE
        WHEN at.time_in IS NOT NULL AND at.time_out IS NOT NULL THEN 'complete'
        WHEN at.time_in IS NOT NULL THEN 'incomplete'
        ELSE NULL
      END AS attendance_status,

      pr.participation_status,
      pr.participation_points,
      pr.accomplishment_status,
      pr.accomplishment_points,
      pr.participated_at,
      pr.accomplished_at
    FROM activities a
    LEFT JOIN sportfest_days sd
      ON sd.sportfest_date = a.activity_date
    LEFT JOIN daily_attendance at
      ON at.day_id = sd.day_id
      AND at.student_id = ?
    LEFT JOIN participation_records pr
      ON a.activity_id = pr.activity_id
      AND pr.student_id = ?
    ORDER BY a.activity_date ASC
  `;

  db.query(sql, [student_id, student_id], (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    const totalParticipation = results.reduce(
      (sum, r) => sum + Number(r.participation_points || 0),
      0
    );

    const totalAccomplishment = results.reduce(
      (sum, r) => sum + Number(r.accomplishment_points || 0),
      0
    );

    const completedActivities = results.filter(
      (r) =>
        r.participation_status === "participated" ||
        r.accomplishment_status === "accomplished"
    ).length;

    res.json({
      activities: results,
      summary: {
        total_activities: results.length,
        completed_activities: completedActivities,
        participation_points: totalParticipation,
        accomplishment_points: totalAccomplishment,
        total_points: totalParticipation + totalAccomplishment,
      },
    });
  });
});

module.exports = router;