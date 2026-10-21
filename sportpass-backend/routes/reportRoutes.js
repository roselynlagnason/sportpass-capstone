const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/summary", requireAdmin, async (req, res) => {
  try {
    const data = {};

    db.query(
      "SELECT COUNT(*) total FROM students",
      (err, students) => {
        if (err) return res.status(500).json({ message: "Database error" });

        data.total_students = students[0].total;

        db.query(
          "SELECT COUNT(*) total FROM activities",
          (err2, activities) => {
            if (err2) return res.status(500).json({ message: "Database error" });

            data.total_activities = activities[0].total;

            db.query(
              `
              SELECT
              COALESCE(SUM(participation_points),0) participation,
              COALESCE(SUM(accomplishment_points),0) accomplishment
              FROM participation_records
              `,
              (err3, points) => {
                if (err3) return res.status(500).json({ message: "Database error" });

                data.participation_points =
                  Number(points[0].participation);

                data.accomplishment_points =
                  Number(points[0].accomplishment);

                data.total_points =
                  data.participation_points +
                  data.accomplishment_points;

                db.query(
                  `
                  SELECT
                  COUNT(*) totalAttendance
                  FROM daily_attendance
                  WHERE time_in IS NOT NULL
                  `,
                  (err4, attendance) => {
                    if (err4) return res.status(500).json({ message: "Database error" });

                    data.total_attendance =
                      attendance[0].totalAttendance;

                    db.query(
                      `
                      SELECT
                      year_level,
                      SUM(
                        participation_points+
                        accomplishment_points
                      ) points

                      FROM participation_records pr

                      JOIN students s
                      ON pr.student_id=s.student_id

                      GROUP BY year_level
                      `,
                      (err5, yearLevels) => {
                        if (err5)
                          return res.status(500).json({ message: "Database error" });

                        data.year_level_points = yearLevels;

                        res.json(data);
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  } catch {
    res.status(500).json({
      message: "Server Error",
    });
  }
});

/* Activity completion: attendance, participation and accomplishment
 * counts for each activity. Subqueries keep the counts from multiplying. */
router.get("/activities", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      act.activity_id,
      act.sport_name,
      act.activity_name,
      act.activity_date,
      act.activity_time,
      act.activity_location,
      act.status,
      act.participation_points,
      act.accomplishment_points,
      (SELECT COUNT(*) FROM daily_attendance d
        JOIN sportfest_days sd ON sd.day_id = d.day_id
        WHERE sd.sportfest_date = act.activity_date AND d.time_in IS NOT NULL) AS attended,
      (SELECT COUNT(*) FROM daily_attendance d
        JOIN sportfest_days sd ON sd.day_id = d.day_id
        WHERE sd.sportfest_date = act.activity_date
          AND d.time_in IS NOT NULL AND d.time_out IS NOT NULL) AS completed_attendance,
      (SELECT COUNT(*) FROM participation_records pr
        WHERE pr.activity_id = act.activity_id
          AND pr.participation_status = 'participated') AS participated,
      (SELECT COUNT(*) FROM participation_records pr
        WHERE pr.activity_id = act.activity_id
          AND pr.accomplishment_status = 'accomplished') AS accomplished,
      (SELECT COALESCE(SUM(pr.participation_points + pr.accomplishment_points), 0)
        FROM participation_records pr
        WHERE pr.activity_id = act.activity_id) AS points_awarded
    FROM activities act
    ORDER BY act.activity_date ASC, act.activity_time ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});

/* Attendance summary: every time-in / time-out record, per sportfest day. */
router.get("/attendance", requireAdmin, (req, res) => {
  const sql = `
    SELECT
      d.attendance_id,
      sd.sportfest_date AS attendance_date,
      d.time_in,
      d.time_out,
      s.student_id,
      s.first_name,
      s.last_name,
      s.year_level,
      s.section,
      'Sportfest Day' AS sport_name,
      COALESCE(NULLIF(sd.title, ''), DATE_FORMAT(sd.sportfest_date, '%b %e, %Y')) AS activity_name,
      '' AS activity_location
    FROM daily_attendance d
    JOIN students s ON d.student_id = s.student_id
    JOIN sportfest_days sd ON d.day_id = sd.day_id
    ORDER BY sd.sportfest_date DESC, s.last_name ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(rows);
  });
});

module.exports = router;