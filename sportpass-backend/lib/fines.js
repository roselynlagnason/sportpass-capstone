/*
 * SPORTPASS fine rules — the single place fines are calculated.
 *
 * Attendance is taken once per sportfest day (days are chosen by the
 * officers on the Sportfest Days page): one time-in and one time-out.
 *
 *  - Each missed scan (no time-in, or no time-out) costs the
 *    "fine per missed scan" setting (default 30).
 *  - A student with no attendance record for a sportfest day is absent:
 *    both scans are missed, so the fine is 2 x that amount.
 *  - Absence only applies to students whose account existed on that day.
 *  - An admin-set fine_amount (> 0) on a record overrides the calculation.
 *  - Fines only count once the day is over: an admin closed it, or its
 *    date has passed.
 */

const settings = require("./settings");

// Read fresh for every query, so a change on the Settings page applies
// immediately. Always a validated whole number, so it is safe in SQL.
function finePerScan() {
  return Math.max(0, Math.floor(Number(settings.get("fine_per_missed_scan")) || 0));
}

// `sd` must be the alias of the sportfest_days table.
const DAY_IS_OVER = "(sd.status = 'closed' OR sd.sportfest_date < CURDATE())";

// Fine for one daily_attendance row; `d` is its alias.
function attendanceFineAmount(d = "d") {
  const fine = finePerScan();
  return `
  CASE
    WHEN ${d}.fine_amount > 0 THEN ${d}.fine_amount
    ELSE IF(${d}.time_in IS NULL, ${fine}, 0)
       + IF(${d}.time_out IS NULL, ${fine}, 0)
  END`;
}

// A readable name for a day: its title, or its date.
const DAY_NAME = "COALESCE(NULLIF(sd.title, ''), DATE_FORMAT(sd.sportfest_date, '%b %e, %Y'))";

/**
 * Every fine (missed scans, absences and manual fines), optionally for
 * one student. Returns { sql, params }. Columns:
 *   fine_id, fine_type, student_id, attendance_date, missed_in, missed_out,
 *   amount, payment_status, attendance_id, activity_id, day_id, sport_name,
 *   activity_name, first_name, last_name, year_level, section, gender
 */
function allFinesQuery(studentId = null) {
  const params = [];
  const fine = finePerScan();
  const forStudent = (column) => {
    if (studentId === null) return "";
    params.push(studentId);
    return ` AND ${column} = ?`;
  };

  const attendancePart = `
    SELECT
      NULL AS fine_id,
      'attendance' AS fine_type,
      d.student_id,
      sd.sportfest_date AS attendance_date,
      IF(d.time_in IS NULL, 1, 0) AS missed_in,
      IF(d.time_out IS NULL, 1, 0) AS missed_out,
      ${attendanceFineAmount("d")} AS amount,
      COALESCE(d.payment_status, 'unpaid') AS payment_status,
      d.attendance_id,
      NULL AS activity_id,
      sd.day_id,
      'Sportfest Day' AS sport_name,
      ${DAY_NAME} AS activity_name,
      s.first_name, s.last_name, s.year_level, s.section, s.gender
    FROM daily_attendance d
    JOIN sportfest_days sd ON d.day_id = sd.day_id
    JOIN students s ON d.student_id = s.student_id
    WHERE (d.time_in IS NULL OR d.time_out IS NULL)
      AND ${DAY_IS_OVER}${forStudent("d.student_id")}`;

  const absencePart = `
    SELECT
      NULL AS fine_id,
      'absence' AS fine_type,
      s.student_id,
      sd.sportfest_date AS attendance_date,
      1 AS missed_in,
      1 AS missed_out,
      ${fine * 2} AS amount,
      'unpaid' AS payment_status,
      NULL AS attendance_id,
      NULL AS activity_id,
      sd.day_id,
      'Sportfest Day' AS sport_name,
      ${DAY_NAME} AS activity_name,
      s.first_name, s.last_name, s.year_level, s.section, s.gender
    FROM students s
    JOIN users u ON s.user_id = u.user_id
    CROSS JOIN sportfest_days sd
    LEFT JOIN daily_attendance d
      ON d.student_id = s.student_id AND d.day_id = sd.day_id
    WHERE d.attendance_id IS NULL
      AND DATE(u.created_at) <= sd.sportfest_date
      AND ${DAY_IS_OVER}${forStudent("s.student_id")}`;

  const manualPart = `
    SELECT
      mf.fine_id,
      'manual' AS fine_type,
      mf.student_id,
      mf.fine_date AS attendance_date,
      mf.missed_in,
      mf.missed_out,
      mf.amount,
      COALESCE(mf.payment_status, 'unpaid') AS payment_status,
      NULL AS attendance_id,
      NULL AS activity_id,
      NULL AS day_id,
      'Manual Fine' AS sport_name,
      'No Attendance Record' AS activity_name,
      s.first_name, s.last_name, s.year_level, s.section, s.gender
    FROM manual_fines mf
    JOIN students s ON mf.student_id = s.student_id
    WHERE 1 = 1${forStudent("mf.student_id")}`;

  return {
    sql: `${attendancePart} UNION ALL ${absencePart} UNION ALL ${manualPart}`,
    params,
  };
}

module.exports = {
  finePerScan,
  DAY_IS_OVER,
  DAY_NAME,
  attendanceFineAmount,
  allFinesQuery,
};
