const express = require("express");
const db = require("../db");
const { requireAdmin, selfOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { student_id } = req.params;

  const sql = `
    SELECT 
      n.*,
      CASE WHEN nr.read_id IS NULL THEN 0 ELSE 1 END AS is_read
    FROM notifications n
    LEFT JOIN notification_reads nr
      ON n.notification_id = nr.notification_id
      AND nr.student_id = ?
    WHERE n.recipient_role IN ('all', 'student')
    ORDER BY n.created_at DESC
  `;

  db.query(sql, [student_id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(rows);
  });
});

router.get("/", requireAdmin, (req, res) => {
  const sql = `
    SELECT *
    FROM notifications
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(rows);
  });
});

router.post("/", requireAdmin, (req, res) => {
  const { title, message, type, recipient_role, created_by } = req.body;

  if (!title || !message) {
    return res.status(400).json({ message: "Title and message are required" });
  }

  const sql = `
    INSERT INTO notifications
    (title, message, type, recipient_role, created_by)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      title,
      message,
      type || "system",
      recipient_role || "all",
      created_by || null,
    ],
    (err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to send notification" });
      }

      res.json({ message: "Notification sent successfully" });
    }
  );
});

router.put("/read/:notification_id", (req, res) => {
  const { notification_id } = req.params;
  const student_id = req.user.student_id;

  if (!student_id) {
    return res.status(400).json({ message: "Student ID is required" });
  }

  const sql = `
    INSERT IGNORE INTO notification_reads
    (notification_id, student_id)
    VALUES (?, ?)
  `;

  db.query(sql, [notification_id, student_id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to mark as read" });
    res.json({ message: "Marked as read" });
  });
});

router.put("/read-all/:student_id", selfOrAdmin("student_id"), (req, res) => {
  const { student_id } = req.params;

  const sql = `
    INSERT IGNORE INTO notification_reads
    (notification_id, student_id)
    SELECT notification_id, ?
    FROM notifications
    WHERE recipient_role IN ('all', 'student')
  `;

  db.query(sql, [student_id], (err) => {
    if (err) return res.status(500).json({ message: "Failed to mark all as read" });
    res.json({ message: "All notifications marked as read" });
  });
});

module.exports = router;