const express = require("express");
const db = require("../db");
const { requireAdmin, selfOrAdmin } = require("../middleware/auth");
const {
  finePerScan,
  DAY_IS_OVER,
  allFinesQuery,
} = require("../lib/fines");

const router = express.Router();

/* ADMIN: Get all fines (attendance, absence and manual) */
router.get("/", requireAdmin, (req, res) => {
  const { sql, params } = allFinesQuery();

  db.query(`${sql} ORDER BY attendance_date DESC`, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

/* STUDENT: Get my fines (admins may view any student's) */
router.get("/student/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { sql, params } = allFinesQuery(req.params.student_id);

  db.query(`${sql} ORDER BY attendance_date DESC`, params, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

/* ADMIN: Add manual fine */
router.post("/manual", requireAdmin, (req, res) => {
  const { student_id, fine_date, missed_in, missed_out } = req.body;

  if (!student_id || !fine_date || (!missed_in && !missed_out)) {
    return res.status(400).json({
      message: "Student, date and at least one missed scan are required.",
    });
  }

  const fine = finePerScan();
  const amount = (missed_in ? fine : 0) + (missed_out ? fine : 0);

  const sql = `
    INSERT INTO manual_fines
    (student_id, fine_date, missed_in, missed_out, amount, payment_status)
    VALUES (?, ?, ?, ?, ?, 'unpaid')
  `;

  db.query(
    sql,
    [student_id, fine_date, missed_in ? 1 : 0, missed_out ? 1 : 0, amount],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to add manual fine" });
      }

      res.json({ message: "Manual fine added successfully" });
    }
  );
});

/* ADMIN: Mark an absence fine as paid.
 * An absent student has no attendance record for that sportfest day, so we
 * record one (no time-in, no time-out) marked as paid. From then on it is
 * listed as a paid fine with the same amount. */
router.put("/absence/:day_id/:student_id/mark-paid", requireAdmin, (req, res) => {
  const { day_id, student_id } = req.params;

  db.query(
    `SELECT sd.day_id FROM sportfest_days sd WHERE sd.day_id = ? AND ${DAY_IS_OVER}`,
    [day_id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }

      if (rows.length === 0) {
        return res.status(400).json({
          message: "This sportfest day isn't over yet, so there is no absence fine to pay.",
        });
      }

      db.query(
        `INSERT INTO daily_attendance (student_id, day_id, time_in, time_out, payment_status)
         VALUES (?, ?, NULL, NULL, 'paid')`,
        [student_id, day_id],
        (insertErr) => {
          if (insertErr) {
            if (insertErr.code === "ER_DUP_ENTRY") {
              return res.status(400).json({
                message: "This student has an attendance record for that day. Mark that fine as paid instead.",
              });
            }
            console.error(insertErr);
            return res.status(500).json({ message: "Failed to mark absence fine as paid" });
          }
          res.json({ message: "Absence fine marked as paid" });
        }
      );
    }
  );
});

/* ADMIN: Mark attendance fine as paid */
router.put("/:attendance_id/mark-paid", requireAdmin, (req, res) => {
  const { attendance_id } = req.params;

  const sql = `
    UPDATE daily_attendance
    SET payment_status = 'paid'
    WHERE attendance_id = ?
  `;

  db.query(sql, [attendance_id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to mark paid" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    res.json({ message: "Attendance fine marked as paid" });
  });
});

/* ADMIN: Mark manual fine as paid */
router.put("/manual/:fine_id/mark-paid", requireAdmin, (req, res) => {
  const { fine_id } = req.params;

  const sql = `
    UPDATE manual_fines
    SET payment_status = 'paid'
    WHERE fine_id = ?
  `;

  db.query(sql, [fine_id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to mark manual fine paid" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Manual fine not found" });
    }

    res.json({ message: "Manual fine marked as paid" });
  });
});

module.exports = router;
