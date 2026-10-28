const fs = require("fs");
const path = require("path");

/*
 * Small, safe database updates that run when the server starts.
 * Each step checks first, so running it again changes nothing.
 * The same changes are written out in migrations/001_settings_course_requirements.sql
 */

// Runs database/schema.sql (every table) and database/seed-admin.sql (the
// first admin account) on an empty database, e.g. a new Aiven database.
function createAllTables(db, done) {
  const read = (f) => fs.readFileSync(path.join(__dirname, "..", "database", f), "utf8");
  const statements = (sql) =>
    sql
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n")
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !/^CREATE DATABASE/i.test(s) && !/^USE\s/i.test(s));

  let list;
  try {
    list = [...statements(read("schema.sql")), ...statements(read("seed-admin.sql"))];
  } catch (err) {
    return done(err);
  }

  const next = () => {
    const sql = list.shift();
    if (!sql) {
      console.log("  created all tables and the first admin account (admin@sportpass.local)");
      return done();
    }
    db.query(sql, (err) => (err ? done(err) : next()));
  };
  next();
}

const STEPS = [
  {
    name: "all SPORTPASS tables (empty database)",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
    apply: createAllTables,
  },
  {
    name: "system_settings table",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'system_settings'`,
    apply: `CREATE TABLE system_settings (
              setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
              setting_value TEXT NOT NULL,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )`,
  },
  {
    name: "students.course column",
    check: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'course'`,
    apply: `ALTER TABLE students ADD COLUMN course VARCHAR(20) NULL AFTER department`,
  },
  {
    name: "activities.participation_requirement column",
    check: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND COLUMN_NAME = 'participation_requirement'`,
    apply: `ALTER TABLE activities ADD COLUMN participation_requirement TEXT NULL AFTER activity_location`,
  },
  {
    name: "sportfest_days table",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sportfest_days'`,
    apply: `CREATE TABLE sportfest_days (
              day_id INT AUTO_INCREMENT PRIMARY KEY,
              sportfest_date DATE NOT NULL,
              title VARCHAR(150) NULL,
              status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
              created_by INT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uq_sportfest_date (sportfest_date)
            )`,
  },
  {
    name: "daily_attendance table",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'daily_attendance'`,
    apply: `CREATE TABLE daily_attendance (
              attendance_id INT AUTO_INCREMENT PRIMARY KEY,
              student_id VARCHAR(30) NOT NULL,
              day_id INT NOT NULL,
              time_in DATETIME NULL,
              time_out DATETIME NULL,
              fine_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
              payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY uq_daily_student_day (student_id, day_id),
              KEY idx_daily_day (day_id)
            )`,
    // Attendance used to be recorded per activity. Turn every date that
    // has attendance into a sportfest day, and keep one record per student
    // per day: earliest time-in, latest time-out, paid if any fine was paid.
    after: [
      `INSERT IGNORE INTO sportfest_days (sportfest_date)
       SELECT DISTINCT attendance_date FROM attendance WHERE attendance_date IS NOT NULL`,
      `INSERT IGNORE INTO daily_attendance (student_id, day_id, time_in, time_out, fine_amount, payment_status)
       SELECT a.student_id, sd.day_id, MIN(a.time_in), MAX(a.time_out), MAX(a.fine_amount),
              IF(SUM(a.payment_status = 'paid') > 0, 'paid', 'unpaid')
       FROM attendance a
       JOIN sportfest_days sd ON sd.sportfest_date = a.attendance_date
       GROUP BY a.student_id, sd.day_id`,
    ],
  },
  {
    name: "students.photo_data column (profile photos stored in the database)",
    check: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'students' AND COLUMN_NAME = 'photo_data'`,
    apply: `ALTER TABLE students
              ADD COLUMN photo_data MEDIUMBLOB NULL AFTER profile_photo,
              ADD COLUMN photo_type VARCHAR(30) NULL AFTER photo_data`,
  },
  {
    name: "sportfest_days.closes_at column (closing time)",
    check: `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sportfest_days' AND COLUMN_NAME = 'closes_at'`,
    apply: `ALTER TABLE sportfest_days ADD COLUMN closes_at TIME NULL AFTER status`,
  },
  {
    name: "fine_payments table (partial payments and notes)",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fine_payments'`,
    apply: `CREATE TABLE fine_payments (
              payment_id INT AUTO_INCREMENT PRIMARY KEY,
              student_id VARCHAR(30) NOT NULL,
              day_id INT NULL,
              fine_id INT NULL,
              amount DECIMAL(10,2) NOT NULL,
              note VARCHAR(255) NULL,
              recorded_by INT NULL,
              paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              KEY idx_fine_payments_day (student_id, day_id),
              KEY idx_fine_payments_manual (fine_id),
              CONSTRAINT fk_payments_student FOREIGN KEY (student_id)
                REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE,
              CONSTRAINT fk_payments_day FOREIGN KEY (day_id)
                REFERENCES sportfest_days (day_id) ON DELETE RESTRICT,
              CONSTRAINT fk_payments_recorder FOREIGN KEY (recorded_by)
                REFERENCES users (user_id) ON DELETE SET NULL
            ) ENGINE=InnoDB`,
  },
  {
    name: "offline_scans table (offline-first sync)",
    check: `SELECT COUNT(*) AS n FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offline_scans'`,
    apply: `CREATE TABLE offline_scans (
              client_id VARCHAR(64) NOT NULL PRIMARY KEY,
              kind VARCHAR(20) NOT NULL,
              user_id INT NULL,
              status_code SMALLINT NOT NULL,
              response TEXT NOT NULL,
              scanned_at DATETIME NOT NULL,
              synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              KEY idx_offline_scans_synced (synced_at)
            ) ENGINE=InnoDB`,
  },
  {
    name: "BSIT as every student's course",
    check: `SELECT COUNT(*) = 0 AS n FROM students WHERE course IS NULL OR course <> 'BSIT'`,
    apply: `UPDATE students SET course = 'BSIT' WHERE course IS NULL OR course <> 'BSIT'`,
  },
];

function migrate(db, done = () => {}) {
  let i = 0;
  const next = () => {
    if (i >= STEPS.length) return done();
    const step = STEPS[i++];
    db.query(step.check, (err, rows) => {
      if (err) {
        console.log(`Database update skipped (${step.name}): ${err.message}`);
        return next();
      }
      if (!rows || !rows[0] || Number(rows[0].n) > 0) return next();
      const apply = (cb) =>
        typeof step.apply === "function" ? step.apply(db, cb) : db.query(step.apply, cb);
      apply((applyErr) => {
        if (applyErr) {
          console.log(`Database update failed (${step.name}): ${applyErr.message}`);
          return next();
        }
        console.log(`Database updated: added ${step.name}`);

        // Follow-up queries (e.g. copying existing data), one at a time.
        const after = [...(step.after || [])];
        const runAfter = () => {
          const sql = after.shift();
          if (!sql) return next();
          db.query(sql, (afterErr, result) => {
            if (afterErr) console.log(`  follow-up failed: ${afterErr.message}`);
            else if (result && result.affectedRows) console.log(`  copied ${result.affectedRows} existing record(s)`);
            runAfter();
          });
        };
        runAfter();
      });
    });
  };
  next();
}

module.exports = migrate;
