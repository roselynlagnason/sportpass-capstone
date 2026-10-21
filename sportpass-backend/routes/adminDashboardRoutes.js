const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");
const { allFinesQuery } = require("../lib/fines");

const router = express.Router();

router.get("/", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM students) AS total_students,
      (SELECT COUNT(*) FROM activities) AS total_activities,
      (SELECT COUNT(*) FROM daily_attendance WHERE time_in IS NOT NULL) AS total_attendance,
      (SELECT COALESCE(SUM(participation_points), 0) FROM participation_records) AS participation_points,
      (SELECT COALESCE(SUM(accomplishment_points), 0) FROM participation_records) AS accomplishment_points
  `;

  db.query(sql, (err, summaryRows) => {
    if (err) return res.status(500).json({ message: "Summary error" });

    const summary = summaryRows[0];

    // Unpaid fines only, using the same rules as the Fines page.
    const fines = allFinesQuery();
    const fineSql = `
      SELECT COALESCE(SUM(f.amount), 0) AS outstanding_fines
      FROM (${fines.sql}) AS f
      WHERE f.payment_status <> 'paid'
    `;

    db.query(fineSql, fines.params, (fineErr, fineRows) => {
      if (fineErr) return res.status(500).json({ message: "Fine error" });

      const rankingSql = `
        SELECT
          s.student_id,
          s.first_name,
          s.last_name,
          s.year_level,
          s.section,
          COALESCE(SUM(pr.participation_points), 0) AS participation_points,
          COALESCE(SUM(pr.accomplishment_points), 0) AS accomplishment_points,
          COALESCE(SUM(pr.participation_points + pr.accomplishment_points), 0) AS total_points
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
        LIMIT 5
      `;

      db.query(rankingSql, (rankErr, rankingRows) => {
        if (rankErr) return res.status(500).json({ message: "Ranking error" });

        // Students with the same points share a rank (1, 2, 2, 4, ...).
        let previousPoints = null;
        let previousRank = 0;
        const ranked = rankingRows.map((r, index) => {
          const points = Number(r.total_points);
          const rank = points === previousPoints ? previousRank : index + 1;
          previousPoints = points;
          previousRank = rank;
          return { rank, ...r };
        });

        const activitySql = `
          SELECT
            activity_id,
            sport_name,
            activity_name,
            activity_date,
            activity_time,
            activity_location,
            status
          FROM activities
          ORDER BY activity_date DESC, activity_time DESC
          LIMIT 5
        `;

        db.query(activitySql, (activityErr, activityRows) => {
          if (activityErr)
            return res.status(500).json({ message: "Activity error" });

          const yearSql = `
            SELECT
              s.year_level,
              COUNT(DISTINCT s.student_id) AS students,
              COALESCE(SUM(pr.participation_points + pr.accomplishment_points), 0) AS points
            FROM students s
            LEFT JOIN participation_records pr
              ON s.student_id = pr.student_id
            GROUP BY s.year_level
            ORDER BY points DESC
          `;

          db.query(yearSql, (yearErr, yearRows) => {
            if (yearErr)
              return res.status(500).json({ message: "Year level error" });

            res.json({
              summary: {
                total_students: summary.total_students || 0,
                total_activities: summary.total_activities || 0,
                total_attendance: summary.total_attendance || 0,
                participation_points: Number(summary.participation_points || 0),
                accomplishment_points: Number(summary.accomplishment_points || 0),
                total_points:
                  Number(summary.participation_points || 0) +
                  Number(summary.accomplishment_points || 0),
                outstanding_fines: Number(fineRows[0].outstanding_fines || 0),
              },
              top_students: ranked,
              recent_activities: activityRows,
              year_level_points: yearRows,
            });
          });
        });
      });
    });
  });
});

module.exports = router;