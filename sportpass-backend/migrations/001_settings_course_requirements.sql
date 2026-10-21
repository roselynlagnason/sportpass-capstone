-- SPORTPASS database update (October 2026)
-- The backend applies these automatically on startup (lib/migrate.js).
-- Run manually only if you prefer to update the database yourself.

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Student's course (e.g. BSIT, BSCS)
ALTER TABLE students ADD COLUMN course VARCHAR(20) NULL AFTER department;

-- What a student must do or bring to take part in an activity
ALTER TABLE activities ADD COLUMN participation_requirement TEXT NULL AFTER activity_location;

-- Sportfest days chosen by the officers, and attendance per day
-- (one time-in and one time-out per student per sportfest day).
CREATE TABLE IF NOT EXISTS sportfest_days (
  day_id INT AUTO_INCREMENT PRIMARY KEY,
  sportfest_date DATE NOT NULL,
  title VARCHAR(150) NULL,
  status ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sportfest_date (sportfest_date)
);

CREATE TABLE IF NOT EXISTS daily_attendance (
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
);

-- Copy older per-activity attendance into sportfest days (run once).
INSERT IGNORE INTO sportfest_days (sportfest_date)
SELECT DISTINCT attendance_date FROM attendance WHERE attendance_date IS NOT NULL;

INSERT IGNORE INTO daily_attendance (student_id, day_id, time_in, time_out, fine_amount, payment_status)
SELECT a.student_id, sd.day_id, MIN(a.time_in), MAX(a.time_out), MAX(a.fine_amount),
       IF(SUM(a.payment_status = 'paid') > 0, 'paid', 'unpaid')
FROM attendance a
JOIN sportfest_days sd ON sd.sportfest_date = a.attendance_date
GROUP BY a.student_id, sd.day_id;
