const express = require("express");
const db = require("../db");
const { selfOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { student_id } = req.params;

  const sql = `
    SELECT
      COUNT(DISTINCT pr.activity_id) AS activities_joined,
      COALESCE(SUM(pr.participation_points + pr.accomplishment_points), 0) AS total_points
    FROM participation_records pr
    WHERE pr.student_id = ?
      AND (
        pr.participation_status = 'participated'
        OR pr.accomplishment_status = 'accomplished'
      )
  `;

  db.query(sql, [student_id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });

    res.json({
      activities_joined: rows[0].activities_joined || 0,
      total_points: Number(rows[0].total_points || 0),
    });
  });
});

module.exports = router;