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
 *  - Fines only count once the day is over: an admin closed it, its
 *    closing time (closes_at) has passed, or its date has passed.
 */

const settings = require("./settings");

// Read fresh for every query, so a change on the Settings page applies
// immediately. Always a validated whole number, so it is safe in SQL.
function finePerScan() {
  return Math.max(0, Math.floor(Number(settings.get("fine_per_missed_scan")) || 0));
}

// `sd` must be the alias of the sportfest_days table. A day is over when an
// admin closed it, its date has passed, or today's closing time has passed.
const DAY_IS_OVER = `(sd.status = 'closed' OR sd.sportfest_date < CURDATE()
  OR (sd.sportfest_date = CURDATE() AND sd.closes_at IS NOT NULL AND CURTIME() >= sd.closes_at))`;

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

// Payments recorded toward a day fine / a manual fine (fine_payments table).
const PAID_FOR_DAY = (student, day) =>
  `(SELECT COALESCE(SUM(fp.amount), 0) FROM fine_payments fp WHERE fp.student_id = ${student} AND fp.day_id = ${day})`;
const NOTE_FOR_DAY = (student, day) =>
  `(SELECT fp.note FROM fine_payments fp WHERE fp.student_id = ${student} AND fp.day_id = ${day}
      AND fp.note IS NOT NULL AND fp.note <> '' ORDER BY fp.paid_at DESC, fp.payment_id DESC LIMIT 1)`;
const PAID_FOR_MANUAL = (fineId) =>
  `(SELECT COALESCE(SUM(fp.amount), 0) FROM fine_payments fp WHERE fp.fine_id = ${fineId})`;
const NOTE_FOR_MANUAL = (fineId) =>
  `(SELECT fp.note FROM fine_payments fp WHERE fp.fine_id = ${fineId}
      AND fp.note IS NOT NULL AND fp.note <> '' ORDER BY fp.paid_at DESC, fp.payment_id DESC LIMIT 1)`;

/**
 * Adds amount_paid, balance and payment_status (unpaid / partial / paid) to
 * a row that has the fine amount, legacy_paid (an older "Mark Paid" with no
 * payment rows) and paid_raw (sum of payments).
 */
function settle(row, amountField = "amount") {
  const amount = Number(row[amountField] || 0);
  const legacy = Number(row.legacy_paid) === 1;
  const paid = legacy ? amount : Math.min(amount, Number(row.paid_raw || 0));
  const balance = Math.max(0, Math.round((amount - paid) * 100) / 100);
  const { legacy_paid, paid_raw, ...rest } = row;
  return {
    ...rest,
    amount_paid: paid,
    balance,
    payment_status: amount <= 0 ? "none" : balance <= 0 ? "paid" : paid > 0 ? "partial" : "unpaid",
  };
}

// A readable name for a day: its title, or its date.
const DAY_NAME = "COALESCE(NULLIF(sd.title, ''), DATE_FORMAT(sd.sportfest_date, '%b %e, %Y'))";

/**
 * Every fine (missed scans, absences and manual fines), optionally for
 * one student. Returns { sql, params }. Columns:
 *   fine_id, fine_type, student_id, attendance_date, missed_in, missed_out,
 *   amount, attendance_id, activity_id, day_id, sport_name, activity_name,
 *   first_name, last_name, year_level, section, gender, payment_note,
 *   amount_paid, balance, payment_status ('unpaid' | 'partial' | 'paid')
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
      IF(d.payment_status = 'paid', 1, 0) AS legacy_paid,
      ${PAID_FOR_DAY("d.student_id", "sd.day_id")} AS paid_raw,
      ${NOTE_FOR_DAY("d.student_id", "sd.day_id")} AS payment_note,
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
      0 AS legacy_paid,
      ${PAID_FOR_DAY("s.student_id", "sd.day_id")} AS paid_raw,
      ${NOTE_FOR_DAY("s.student_id", "sd.day_id")} AS payment_note,
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
      IF(mf.payment_status = 'paid', 1, 0) AS legacy_paid,
      ${PAID_FOR_MANUAL("mf.fine_id")} AS paid_raw,
      ${NOTE_FOR_MANUAL("mf.fine_id")} AS payment_note,
      NULL AS attendance_id,
      NULL AS activity_id,
      NULL AS day_id,
      'Manual Fine' AS sport_name,
      'No Attendance Record' AS activity_name,
      s.first_name, s.last_name, s.year_level, s.section, s.gender
    FROM manual_fines mf
    JOIN students s ON mf.student_id = s.student_id
    WHERE 1 = 1${forStudent("mf.student_id")}`;

  // Work out what has been paid and what is left for every fine.
  const sql = `
    SELECT f.*,
      IF(f.legacy_paid = 1, f.amount, LEAST(f.amount, f.paid_raw)) AS amount_paid,
      f.amount - IF(f.legacy_paid = 1, f.amount, LEAST(f.amount, f.paid_raw)) AS balance,
      CASE
        WHEN f.legacy_paid = 1 OR f.paid_raw >= f.amount THEN 'paid'
        WHEN f.paid_raw > 0 THEN 'partial'
        ELSE 'unpaid'
      END AS payment_status
    FROM (${attendancePart} UNION ALL ${absencePart} UNION ALL ${manualPart}) AS f`;

  return { sql, params };
}

module.exports = {
  settle,
  PAID_FOR_DAY,
  NOTE_FOR_DAY,
  PAID_FOR_MANUAL,
  finePerScan,
  DAY_IS_OVER,
  DAY_NAME,
  attendanceFineAmount,
  allFinesQuery,
};
