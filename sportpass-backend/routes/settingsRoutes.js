const express = require("express");
const db = require("../db");
const settings = require("../lib/settings");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

/* Any logged-in user: the current settings (students need the event name
 * and reward rules). database=false means the defaults are being used
 * because the settings table couldn't be read. */
router.get("/", (req, res) => {
  settings.load(db, (err) => {
    res.json({ settings: settings.all(), database: !err });
  });
});

/* ADMIN: save settings */
router.put("/", requireAdmin, (req, res) => {
  const { values, error } = settings.validate(req.body);
  if (error) return res.status(400).json({ message: error });

  const keys = Object.keys(values);
  if (keys.length === 0) return res.status(400).json({ message: "Nothing to save." });

  const sql = `
    INSERT INTO system_settings (setting_key, setting_value)
    VALUES ${keys.map(() => "(?, ?)").join(", ")}
    ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
  `;
  const params = keys.flatMap((k) => [k, String(values[k])]);

  db.query(sql, params, (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to save settings." });
    }
    settings.load(db, () => {
      res.json({ message: "Settings saved.", settings: settings.all() });
    });
  });
});

module.exports = router;
