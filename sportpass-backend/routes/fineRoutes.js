const express = require("express");
const db = require("../db");
const { requireAdmin, selfOrAdmin } = require("../middleware/auth");
const {
  finePerScan,
  DAY_IS_OVER,
  allFinesQuery,
  attendanceFineAmount,
  PAID_FOR_DAY,
  PAID_FOR_MANUAL,
  settle,
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

/* ---------------------------------------------------------------------
 * Payments, including partial payments.
 * A fine is identified by student + sportfest day (missed scans or
 * absence) or by fine_id (manual fine). Each payment is stored with its
 * amount and an optional note; the balance is what is left.
 * ------------------------------------------------------------------- */

// Current fine, payments so far and balance for one fine.
function loadFine({ student_id, day_id, fine_id }, cb) {
  if (fine_id) {
    return db.query(
      `SELECT mf.amount, IF(mf.payment_status = 'paid', 1, 0) AS legacy_paid,
              ${PAID_FOR_MANUAL("mf.fine_id")} AS paid_raw, 1 AS is_over
       FROM manual_fines mf WHERE mf.fine_id = ? AND mf.student_id = ?`,
      [fine_id, student_id],
      (err, rows) => cb(err, rows && rows[0] ? settle(rows[0]) : null)
    );
  }
  db.query(
    `SELECT
       CASE
         WHEN d.attendance_id IS NULL THEN
           IF(DATE(u.created_at) <= sd.sportfest_date, ${finePerScan() * 2}, 0)
         ELSE ${attendanceFineAmount("d")}
       END AS amount,
       IF(d.payment_status = 'paid', 1, 0) AS legacy_paid,
       ${PAID_FOR_DAY("s.student_id", "sd.day_id")} AS paid_raw,
       ${DAY_IS_OVER} AS is_over
     FROM students s
     JOIN users u ON u.user_id = s.user_id
     JOIN sportfest_days sd ON sd.day_id = ?
     LEFT JOIN daily_attendance d ON d.student_id = s.student_id AND d.day_id = sd.day_id
     WHERE s.student_id = ?`,
    [day_id, student_id],
    (err, rows) => cb(err, rows && rows[0] ? settle(rows[0]) : null)
  );
}

/* ADMIN: record a payment (full or partial) toward a fine. */
router.post("/payments", requireAdmin, (req, res) => {
  const { student_id, day_id, fine_id } = req.body;
  const amount = Math.round(Number(req.body.amount) * 100) / 100;
  const note = req.body.note ? String(req.body.note).trim() : "";

  if (!student_id || (!day_id && !fine_id)) {
    return res.status(400).json({ message: "Missing student or fine." });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Enter an amount greater than zero." });
  }
  if (note.length > 255) {
    return res.status(400).json({ message: "The note is too long (255 characters at most)." });
  }

  loadFine({ student_id, day_id, fine_id }, (err, fine) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    if (!fine || Number(fine.amount) <= 0) {
      return res.status(404).json({ message: "There is no fine to pay here." });
    }
    if (!Number(fine.is_over)) {
      return res.status(400).json({
        message: "This sportfest day isn't over yet, so its fine isn't final. Close the day first.",
      });
    }
    if (fine.balance <= 0) {
      return res.status(400).json({ message: "This fine is already fully paid." });
    }
    if (amount > fine.balance) {
      return res.status(400).json({
        message: `That is more than the balance of ₱${fine.balance}.`,
      });
    }

    db.query(
      `INSERT INTO fine_payments (student_id, day_id, fine_id, amount, note, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [student_id, fine_id ? null : day_id, fine_id || null, amount, note || null, req.user.user_id],
      (insErr) => {
        if (insErr) {
          console.error(insErr);
          return res.status(500).json({ message: "Failed to record the payment." });
        }
        const balance = Math.round((fine.balance - amount) * 100) / 100;
        res.json({
          message: balance <= 0 ? "Fine fully paid." : `Partial payment recorded. ₱${balance} left to pay.`,
          amount_paid: Math.round((fine.amount_paid + amount) * 100) / 100,
          balance,
          payment_status: balance <= 0 ? "paid" : "partial",
        });
      }
    );
  });
});

/* Payment history of one fine (the student or an admin). */
router.get("/payments/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { day_id, fine_id } = req.query;
  if (!day_id && !fine_id) return res.status(400).json({ message: "Missing day or fine." });

  db.query(
    `SELECT fp.payment_id, fp.amount, fp.note, fp.paid_at, u.email AS recorded_by
     FROM fine_payments fp
     LEFT JOIN users u ON u.user_id = fp.recorded_by
     WHERE fp.student_id = ? AND ${fine_id ? "fp.fine_id = ?" : "fp.day_id = ?"}
     ORDER BY fp.paid_at ASC, fp.payment_id ASC`,
    [req.params.student_id, fine_id || day_id],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Database error" });
      }
      res.json(rows);
    }
  );
});

module.exports = router;
