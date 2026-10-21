const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", (req, res) => {
  const sql = `
    SELECT
      s.student_id,
      s.first_name,
      s.last_name,
      s.year_level,
      s.section,
      COALESCE(SUM(pr.participation_points), 0) AS participation_points,
      COALESCE(SUM(pr.accomplishment_points), 0) AS accomplishment_points,
      COALESCE(SUM(pr.participation_points + pr.accomplishment_points), 0) AS total_points,
      COUNT(DISTINCT pr.activity_id) AS activities_joined
    FROM students s
    LEFT JOIN participation_records pr
      ON s.student_id = pr.student_id
    GROUP BY
      s.student_id,
      s.first_name,
      s.last_name,
      s.year_level,
      s.section
    ORDER BY total_points DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    // Students with the same points share a rank (1, 2, 2, 4, ...).
    let previousPoints = null;
    let previousRank = 0;
    const ranked = results.map((student, index) => {
      const points = Number(student.total_points);
      const rank = points === previousPoints ? previousRank : index + 1;
      previousPoints = points;
      previousRank = rank;
      return { rank, ...student };
    });

    res.json(ranked);
  });
});

module.exports = router;