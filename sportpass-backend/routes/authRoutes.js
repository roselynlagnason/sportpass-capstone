const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const upload = require("../middleware/upload");
const {
  SESSION_TOKEN_TYPE,
  requireAuth,
  requireAdmin,
  requireStudent,
} = require("../middleware/auth");

const settings = require("../lib/settings");

const router = express.Router();

router.post("/register", upload.singlePhoto("profile_photo"), async (req, res) => {
  const {
    student_id,
    first_name,
    last_name,
    email,
    password,
    year_level,
    gender,
    section,
    contact,
  } = req.body;

  // SPORTPASS is for BSIT students only.
  const course = "BSIT";

  const profile_photo = req.file ? upload.photoName(req.file) : null;
  const photo_data = req.file ? req.file.buffer : null;
  const photo_type = req.file ? req.file.mimetype : null;

  if (
    !student_id || !first_name || !last_name || !email || !password || !year_level ||
    !gender || !section || !contact
  ) {
    return res.status(400).json({ message: "Please fill in all required fields." });
  }

  if (!req.file) {
    return res.status(400).json({ message: "Please upload a profile photo." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
    return res.status(400).json({ message: "Please enter a valid email address." });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    // Registration writes two tables, so it uses one pooled connection
    // for the whole transaction and releases it when the response is sent.
    db.getConnection((connErr, conn) => {
      if (connErr) {
        return res.status(500).json({ message: "Database connection error" });
      }

      let released = false;
      const release = () => {
        if (!released) {
          released = true;
          conn.release();
        }
      };
      res.on("finish", release);
      res.on("close", release);

      conn.beginTransaction((transactionErr) => {
        if (transactionErr) {
          return res.status(500).json({ message: "Transaction error" });
        }

        const userSql = `
          INSERT INTO users (email, password, role)
          VALUES (?, ?, 'student')
        `;

        conn.query(userSql, [email, hashedPassword], (userErr, userResult) => {
          if (userErr) {
            return conn.rollback(() => {
              if (userErr.code === "ER_DUP_ENTRY") {
                return res.status(400).json({ message: "Email already exists" });
              }
              return res.status(500).json({ message: "User insert error" });
            });
          }

          const userId = userResult.insertId;

          const studentSql = `
            INSERT INTO students
            (student_id, user_id, first_name, last_name, contact, department, course, year_level, gender, section, profile_photo, photo_data, photo_type)
            VALUES (?, ?, ?, ?, ?, 'Computer Studies Department', ?, ?, ?, ?, ?, ?, ?)
          `;

          conn.query(
            studentSql,
          [
            student_id,
            userId,
            first_name,
            last_name,
            contact || null,
            course || null,
            year_level,
            gender,
            section || null,
            profile_photo,
            photo_data,
            photo_type,
          ],
            (studentErr) => {
              if (studentErr) {
                return conn.rollback(() => {
                  if (studentErr.code === "ER_DUP_ENTRY") {
                    return res.status(400).json({ message: "Student ID already exists" });
                  }
                  return res.status(500).json({ message: "Student insert error" });
                });
              }

              conn.commit((commitErr) => {
                if (commitErr) {
                  return conn.rollback(() => {
                    return res.status(500).json({ message: "Commit error" });
                  });
                }

                res.status(201).json({ message: "Registration successful" });
              });
            }
          );
        });
      });
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;

  const sql = `
    SELECT 
      users.user_id,
      users.email,
      users.password,
      users.role,
      students.student_id,
      students.first_name,
      students.last_name,
      students.contact,
      students.department,
      students.course,
      students.year_level,
      students.gender,
      students.section,
      students.profile_photo
    FROM users
    LEFT JOIN students ON users.user_id = students.user_id
    WHERE users.email = ?
  `;

  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(400).json({ message: "Incorrect email or password." });
    }

    const user = results[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect email or password." });
    }

    const token = jwt.sign(
      {
        type: SESSION_TOKEN_TYPE,
        user_id: user.user_id,
        role: user.role,
        student_id: user.student_id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        role: user.role,
        student_id: user.student_id,
        first_name: user.first_name,
        last_name: user.last_name,
        full_name:
          user.first_name && user.last_name
            ? `${user.first_name} ${user.last_name}`
            : "Administrator",
        contact: user.contact,
        department: user.department,
        course: user.course,
        year_level: user.year_level,
        gender: user.gender,
        section: user.section,
        profile_photo: user.profile_photo,
      },
    });
  });
});

router.get("/students", requireAuth, requireAdmin, (req, res) => {
  const sql = `
    SELECT
      students.student_id,
      students.first_name,
      students.last_name,
      students.contact,
      students.department,
      students.course,
      students.year_level,
      students.gender,
      students.section,
      students.profile_photo,
      users.email,
      users.created_at,
      COALESCE(pts.total_points, 0) AS total_points,
      COALESCE(att.days_attended, 0) AS days_attended,
      (SELECT COUNT(*) FROM sportfest_days WHERE sportfest_date <= CURDATE()) AS days_held
    FROM students
    JOIN users ON students.user_id = users.user_id
    LEFT JOIN (
      SELECT student_id, SUM(participation_points + accomplishment_points) AS total_points
      FROM participation_records
      GROUP BY student_id
    ) pts ON pts.student_id = students.student_id
    LEFT JOIN (
      SELECT student_id, COUNT(*) AS days_attended
      FROM daily_attendance
      WHERE time_in IS NOT NULL
      GROUP BY student_id
    ) att ON att.student_id = students.student_id
    ORDER BY students.last_name, students.first_name
  `;

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});

/* ADMIN: Edit a student's details (not the student ID or password). */
router.put("/students/:student_id", requireAuth, requireAdmin, (req, res) => {
  const { student_id } = req.params;
  const { first_name, last_name, email, contact, year_level, gender, section } =
    req.body;

  if (!first_name || !last_name || !email || !year_level) {
    return res.status(400).json({
      message: "First name, last name, email and year level are required.",
    });
  }

  const sql = `
    UPDATE students s
    JOIN users u ON s.user_id = u.user_id
    SET
      s.first_name = ?,
      s.last_name = ?,
      s.contact = ?,
      s.year_level = ?,
      s.gender = ?,
      s.section = ?,
      u.email = ?
    WHERE s.student_id = ?
  `;

  db.query(
    sql,
    [
      first_name.trim(),
      last_name.trim(),
      contact || null,
      year_level,
      gender || null,
      section || null,
      email.trim(),
      student_id,
    ],
    (err, result) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(400).json({ message: "That email is already used by another account." });
        }
        console.error(err);
        return res.status(500).json({ message: "Failed to update student." });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Student not found." });
      }

      res.json({ message: "Student updated successfully." });
    }
  );
});

/* ADMIN: Reset a student's password. Returns a temporary password for the
 * admin to give to the student, who should change it after logging in. */
router.put("/students/:student_id/reset-password", requireAuth, requireAdmin, async (req, res) => {
  const crypto = require("crypto");
  // No look-alike characters (0/O, 1/l/I) so it's easy to read out.
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const temporary = Array.from(crypto.randomBytes(10), (b) => alphabet[b % alphabet.length]).join("");

  try {
    const hashed = await bcrypt.hash(temporary, 10);
    db.query(
      `UPDATE users u JOIN students s ON s.user_id = u.user_id
       SET u.password = ? WHERE s.student_id = ?`,
      [hashed, req.params.student_id],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Failed to reset password." });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: "Student not found." });
        }
        res.json({
          message: "Password reset. Give the student this temporary password.",
          temporary_password: temporary,
        });
      }
    );
  } catch {
    res.status(500).json({ message: "Failed to reset password." });
  }
});

/* ADMIN: Delete a student and their login account.
 * Refused if the student already has attendance, participation or fine
 * records, so the sportfest history stays complete. */
router.delete("/students/:student_id", requireAuth, requireAdmin, (req, res) => {
  const { student_id } = req.params;

  const historySql = `
    SELECT
      (SELECT COUNT(*) FROM attendance WHERE student_id = ?) +
      (SELECT COUNT(*) FROM daily_attendance WHERE student_id = ?) +
      (SELECT COUNT(*) FROM participation_records WHERE student_id = ?) +
      (SELECT COUNT(*) FROM manual_fines WHERE student_id = ?) AS records
  `;

  db.query(historySql, [student_id, student_id, student_id, student_id], (histErr, histRows) => {
    if (histErr) {
      console.error(histErr);
      return res.status(500).json({ message: "Database error." });
    }

    if (Number(histRows[0].records) > 0) {
      return res.status(400).json({
        message:
          "This student already has attendance, points or fines recorded, so they can't be deleted. Edit their details instead.",
      });
    }

    db.getConnection((connErr, conn) => {
      if (connErr) return res.status(500).json({ message: "Database connection error." });

      const fail = (message) =>
        conn.rollback(() => {
          conn.release();
          res.status(500).json({ message });
        });

      conn.beginTransaction((txErr) => {
        if (txErr) {
          conn.release();
          return res.status(500).json({ message: "Transaction error." });
        }

        conn.query(
          "SELECT user_id FROM students WHERE student_id = ?",
          [student_id],
          (findErr, rows) => {
            if (findErr) return fail("Failed to delete student.");
            if (rows.length === 0) {
              return conn.rollback(() => {
                conn.release();
                res.status(404).json({ message: "Student not found." });
              });
            }

            const userId = rows[0].user_id;

            conn.query("DELETE FROM notification_reads WHERE student_id = ?", [student_id], () => {
              conn.query("DELETE FROM students WHERE student_id = ?", [student_id], (delErr) => {
                if (delErr) {
                  console.error(delErr);
                  return fail("Failed to delete student.");
                }

                conn.query("DELETE FROM users WHERE user_id = ?", [userId], (userErr) => {
                  if (userErr) {
                    console.error(userErr);
                    return fail("Failed to delete the student's account.");
                  }

                  conn.commit((commitErr) => {
                    if (commitErr) return fail("Failed to delete student.");
                    conn.release();
                    res.json({ message: "Student deleted." });
                  });
                });
              });
            });
          }
        );
      });
    });
  });
});

/* Any logged-in user: change their own password. */
router.post("/change-password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    return res.status(400).json({ message: "Enter your current and new password." });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({ message: "The new password must be at least 8 characters." });
  }

  db.query("SELECT password FROM users WHERE user_id = ?", [req.user.user_id], async (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (rows.length === 0) return res.status(404).json({ message: "Account not found." });

    const ok = await bcrypt.compare(current_password, rows[0].password);
    if (!ok) return res.status(400).json({ message: "Your current password is incorrect." });

    const hashed = await bcrypt.hash(new_password, 10);
    db.query("UPDATE users SET password = ? WHERE user_id = ?", [hashed, req.user.user_id], (updErr) => {
      if (updErr) return res.status(500).json({ message: "Failed to change password." });
      res.json({ message: "Password changed." });
    });
  });
});

// The QR is always made for the logged-in student. Any student_id sent in
// the request body is ignored, so nobody can make a QR for someone else.
router.post("/student-qr-token", requireAuth, requireStudent, (req, res) => {
  const { user_id, student_id } = req.user;

  db.query(
    "SELECT first_name, last_name FROM students WHERE student_id = ? AND user_id = ?",
    [student_id, user_id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Database error" });
      if (rows.length === 0) {
        return res.status(404).json({ message: "Student record not found." });
      }

      const full_name = `${rows[0].first_name} ${rows[0].last_name}`;
      const STUDENT_QR_TTL_SECONDS =
        Number(settings.get("student_qr_ttl_seconds")) || 300;

      const qrToken = jwt.sign(
        {
          type: "SPORTPASS_ATTENDANCE_QR",
          user_id,
          student_id,
          full_name,
          purpose: "attendance",
        },
        process.env.JWT_SECRET,
        { expiresIn: STUDENT_QR_TTL_SECONDS }
      );

      // Offline pass: the phone keeps this one and shows it if it loses
      // internet. It works until the end of today only.
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 0);
      const offlineToken = jwt.sign(
        {
          type: "SPORTPASS_ATTENDANCE_QR",
          user_id,
          student_id,
          full_name,
          purpose: "attendance",
          offline_pass: true,
          exp: Math.floor(endOfToday.getTime() / 1000),
        },
        process.env.JWT_SECRET
      );

      res.json({
        token: qrToken,
        expires_in: STUDENT_QR_TTL_SECONDS,
        offline_token: offlineToken,
        offline_expires_at: endOfToday.toISOString(),
      });
    }
  );
});


module.exports = router;