-- =====================================================================
-- SPORTPASS database schema (MySQL 8 / MariaDB 10.4+)
--
-- Creates every table the SPORTPASS API uses (12), for a fresh install:
--   mysql -u root -p < database/schema.sql
--   mysql -u root -p sportpass_db < database/seed-admin.sql
--
-- Written from the application code (October 2026). If you already have
-- a working database, compare it with:
--   mysqldump -u root -p --no-data sportpass_db > current-schema.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS sportpass_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sportpass_db;

-- ---------------------------------------------------------------------
-- Accounts. role = 'admin' or 'student'. Passwords are bcrypt hashes.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id     INT AUTO_INCREMENT PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        ENUM('admin', 'student') NOT NULL DEFAULT 'student',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- One row per student account.
CREATE TABLE IF NOT EXISTS students (
  student_id     VARCHAR(30)  NOT NULL PRIMARY KEY,
  user_id        INT          NOT NULL,
  first_name     VARCHAR(100) NOT NULL,
  last_name      VARCHAR(100) NOT NULL,
  contact        VARCHAR(30)  NULL,
  department     VARCHAR(100) NOT NULL DEFAULT 'Computer Studies Department',
  course         VARCHAR(20)  NULL,
  year_level     VARCHAR(20)  NOT NULL,
  gender         VARCHAR(20)  NULL,
  section        VARCHAR(20)  NULL,
  profile_photo  VARCHAR(255) NULL,
  photo_data     MEDIUMBLOB   NULL,
  photo_type     VARCHAR(30)  NULL,
  UNIQUE KEY uq_students_user (user_id),
  CONSTRAINT fk_students_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Sportfest activities. status: upcoming -> ongoing -> completed.
-- Fines for an activity count once it is completed or its date has passed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activities (
  activity_id                INT AUTO_INCREMENT PRIMARY KEY,
  sport_name                 VARCHAR(100) NOT NULL,
  activity_name              VARCHAR(150) NOT NULL,
  activity_date              DATE         NOT NULL,
  activity_time              TIME         NULL,
  activity_location          VARCHAR(150) NULL,
  participation_requirement  TEXT         NULL,
  participation_points       INT          NOT NULL DEFAULT 0,
  accomplishment_points      INT          NOT NULL DEFAULT 0,
  status                     ENUM('upcoming', 'ongoing', 'completed') NOT NULL DEFAULT 'upcoming',
  created_by                 INT          NULL,
  created_at                 TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_activities_date (activity_date),
  CONSTRAINT fk_activities_creator FOREIGN KEY (created_by)
    REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Kept for record only: the API signs fresh activity QR codes each time
-- the admin opens them, so these rows are never read back for scanning.
CREATE TABLE IF NOT EXISTS activity_qr_codes (
  qr_id        INT AUTO_INCREMENT PRIMARY KEY,
  activity_id  INT NOT NULL,
  qr_type      ENUM('participation', 'accomplishment') NOT NULL,
  qr_token     TEXT NOT NULL,
  points       INT NOT NULL DEFAULT 0,
  expires_at   DATETIME NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_qr_activity FOREIGN KEY (activity_id)
    REFERENCES activities (activity_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Sportfest days: the dates the officers choose (Sportfest Days page).
-- Attendance is taken once per sportfest day. status 'closed' makes the
-- day's fines final before the date has passed.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sportfest_days (
  day_id          INT AUTO_INCREMENT PRIMARY KEY,
  sportfest_date  DATE         NOT NULL,
  title           VARCHAR(150) NULL,
  status          ENUM('open', 'closed') NOT NULL DEFAULT 'open',
  created_by      INT          NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sportfest_date (sportfest_date),
  CONSTRAINT fk_days_creator FOREIGN KEY (created_by)
    REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- One time-in and one time-out per student per sportfest day, written
-- when an officer scans the student's QR code. A row with both times NULL
-- marks a paid absence fine. fine_amount > 0 overrides the calculated fine.
CREATE TABLE IF NOT EXISTS daily_attendance (
  attendance_id   INT AUTO_INCREMENT PRIMARY KEY,
  student_id      VARCHAR(30) NOT NULL,
  day_id          INT         NOT NULL,
  time_in         DATETIME    NULL,
  time_out        DATETIME    NULL,
  fine_amount     DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status  ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_daily_student_day (student_id, day_id),
  KEY idx_daily_day (day_id),
  CONSTRAINT fk_daily_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_daily_day FOREIGN KEY (day_id)
    REFERENCES sportfest_days (day_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Older per-activity attendance (before October 2026). Kept for history;
-- the system now records attendance in daily_attendance.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
  attendance_id    INT AUTO_INCREMENT PRIMARY KEY,
  student_id       VARCHAR(30) NOT NULL,
  activity_id      INT         NOT NULL,
  attendance_date  DATE        NOT NULL,
  time_in          DATETIME    NULL,
  time_out         DATETIME    NULL,
  status           ENUM('incomplete', 'complete') NOT NULL DEFAULT 'incomplete',
  fine_amount      DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status   ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attendance_lookup (student_id, activity_id, attendance_date),
  KEY idx_attendance_activity (activity_id),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_attendance_activity FOREIGN KEY (activity_id)
    REFERENCES activities (activity_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Points, written when a student scans an activity's QR code.
-- One row per student per activity; each kind of point is given once.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participation_records (
  participation_id       INT AUTO_INCREMENT PRIMARY KEY,
  student_id             VARCHAR(30) NOT NULL,
  activity_id            INT         NOT NULL,
  participation_status   ENUM('participated', 'not_participated') NOT NULL DEFAULT 'not_participated',
  participation_points   INT         NOT NULL DEFAULT 0,
  accomplishment_status  ENUM('accomplished', 'not_accomplished') NOT NULL DEFAULT 'not_accomplished',
  accomplishment_points  INT         NOT NULL DEFAULT 0,
  participated_at        DATETIME    NULL,
  accomplished_at        DATETIME    NULL,
  UNIQUE KEY uq_participation (student_id, activity_id),
  KEY idx_participation_activity (activity_id),
  CONSTRAINT fk_participation_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_participation_activity FOREIGN KEY (activity_id)
    REFERENCES activities (activity_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Fines an admin adds by hand (no attendance record to compute from).
CREATE TABLE IF NOT EXISTS manual_fines (
  fine_id         INT AUTO_INCREMENT PRIMARY KEY,
  student_id      VARCHAR(30) NOT NULL,
  fine_date       DATE        NOT NULL,
  missed_in       TINYINT(1)  NOT NULL DEFAULT 0,
  missed_out      TINYINT(1)  NOT NULL DEFAULT 0,
  amount          DECIMAL(10, 2) NOT NULL DEFAULT 0,
  payment_status  ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
  created_at      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_manual_fines_student (student_id),
  CONSTRAINT fk_manual_fines_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Notifications. recipient_role: 'all', 'student' or 'admin'.
-- type: activity, reminder, ranking, alert, badge or system.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  notification_id  INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(150) NOT NULL,
  message          TEXT         NOT NULL,
  type             VARCHAR(30)  NOT NULL DEFAULT 'system',
  recipient_role   ENUM('all', 'student', 'admin') NOT NULL DEFAULT 'all',
  created_by       INT          NULL,
  created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notifications_created (created_at),
  CONSTRAINT fk_notifications_creator FOREIGN KEY (created_by)
    REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Which student has read which notification. The unique key is what
-- makes "mark as read" safe to repeat (INSERT IGNORE).
CREATE TABLE IF NOT EXISTS notification_reads (
  read_id          INT AUTO_INCREMENT PRIMARY KEY,
  notification_id  INT         NOT NULL,
  student_id       VARCHAR(30) NOT NULL,
  read_at          TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_notification_read (notification_id, student_id),
  CONSTRAINT fk_reads_notification FOREIGN KEY (notification_id)
    REFERENCES notifications (notification_id) ON DELETE CASCADE,
  CONSTRAINT fk_reads_student FOREIGN KEY (student_id)
    REFERENCES students (student_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Settings saved from the admin Settings page (see lib/settings.js).
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key    VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value  TEXT        NOT NULL,
  updated_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
