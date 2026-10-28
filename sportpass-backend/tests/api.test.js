/*
 * SPORTPASS API tests — run with:  npm test
 *
 * These start the real server with a stand-in database, so they check
 * logins, permissions and rules without needing MySQL running.
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

process.chdir(path.join(__dirname, ".."));
require("dotenv").config({ quiet: true });
process.env.PORT = "0"; // any free port
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

// ---- stand-in database -------------------------------------------------
let scenario = {};
const queries = [];
const fakeConn = {
  beginTransaction: (cb) => cb(),
  commit: (cb) => cb(),
  rollback: (cb) => cb(),
  release: () => {},
  query: (...a) => fakeDb.query(...a),
};
const fakeDb = {
  query(sql, params, cb) {
    if (typeof params === "function") { cb = params; params = []; }
    queries.push({ sql, params });
    let rows = [];
    if (/SELECT photo_data, photo_type FROM students/.test(sql)) { rows = scenario.photo ? [{ photo_data: Buffer.from([137, 80, 78, 71]), photo_type: 'image/png' }] : []; return setImmediate(() => cb(null, rows)); }
    if (/SELECT day_id FROM sportfest_days WHERE sportfest_date/.test(sql)) { rows = scenario.isDay ? [{ day_id: 3 }] : []; return setImmediate(() => cb(null, rows)); }
    if (/FROM offline_scans WHERE client_id/.test(sql)) { rows = scenario.seen ? [{ status_code: 200, response: JSON.stringify({ action: "time_in", message: "Time-in recorded successfully." }) }] : []; return setImmediate(() => cb(null, rows)); }
    if (/JOIN sportfest_days sd ON sd.day_id = \?/.test(sql)) { rows = [{ amount: 60, legacy_paid: 0, paid_raw: scenario.paid ?? 0, is_over: scenario.over ?? 1 }]; return setImmediate(() => cb(null, rows)); }
    if (/information_schema/.test(sql)) rows = [{ n: 1 }];
    else if (/AS records/.test(sql)) rows = [{ records: scenario.records ?? 0 }];
    else if (/AS is_past/.test(sql)) rows = [{ is_past: scenario.past ? 1 : 0 }];
    else if (/is_today/.test(sql)) rows = [{ is_today: scenario.today ?? 1, status: "ongoing", after_closing: scenario.afterClosing ? 1 : 0, closes_at: "17:00" }];
    else if (/seconds_since_time_in/.test(sql)) rows = scenario.existing ? [{ attendance_id: 1, time_out: null, seconds_since_time_in: 20 }] : [];
    else if (/FROM students WHERE student_id = \? AND user_id/.test(sql)) rows = [{ first_name: "Ana", last_name: "Cruz" }];
    else if (/SELECT activity_id, (participation_points|sport_name)/.test(sql)) rows = [{ activity_id: 7, sport_name: "Chess", activity_name: "Finals", participation_points: 10, accomplishment_points: 20 }];
    else if (/time_in IS NOT NULL\s+LIMIT 1/.test(sql)) rows = scenario.timedIn ? [{ attendance_id: 1 }] : [];
    else if (/SELECT user_id FROM students/.test(sql)) rows = [{ user_id: 9 }];
    else if (/^\s*(UPDATE|DELETE|INSERT)/i.test(sql)) rows = { affectedRows: 1, insertId: 1 };
    setImmediate(() => cb(null, rows));
  },
  getConnection: (cb) => cb(null, fakeConn),
};
require.cache[path.resolve("db.js")] = {
  id: path.resolve("db.js"), filename: path.resolve("db.js"), loaded: true, exports: fakeDb,
};

// ---- start the real server ---------------------------------------------
const express = require("express");
const jwt = require("jsonwebtoken");
let server;
const originalListen = express.application.listen;
express.application.listen = function (...args) {
  server = originalListen.apply(this, args);
  return server;
};
const S = process.env.JWT_SECRET;
const student = jwt.sign({ type: "SPORTPASS_SESSION", user_id: 5, role: "student", student_id: "S1" }, S);
const admin = jwt.sign({ type: "SPORTPASS_SESSION", user_id: 1, role: "admin" }, S);
const studentQR = jwt.sign({ type: "SPORTPASS_ATTENDANCE_QR", student_id: "S1", full_name: "Ana Cruz" }, S, { expiresIn: 300 });
const activityQR = jwt.sign({ type: "SPORTPASS_ACTIVITY_QR", activity_id: 7, qr_type: "accomplishment" }, S, { expiresIn: 120 });

before(async () => {
  require(path.resolve("server.js"));
  await new Promise((r) => setTimeout(r, 200));
});
after(() => server && server.close());

async function call(method, url, token, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}${url}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

const expectStatus = (name, method, url, token, body, status, sc = {}) =>
  test(name, async () => {
    scenario = sc;
    const r = await call(method, url, token, body);
    assert.equal(r.status, status, JSON.stringify(r.json));
  });

// ---- login and roles ---------------------------------------------------
expectStatus("no login is refused", "GET", "/api/fines", null, null, 401);
expectStatus("an old-style login token is refused", "GET", "/api/rankings", jwt.sign({ user_id: 5, role: "student" }, S), null, 401);
expectStatus("a QR code can't be used as a login", "GET", "/api/rankings", studentQR, null, 401);
expectStatus("student can't list all fines", "GET", "/api/fines", student, null, 403);
expectStatus("student can see own fines", "GET", "/api/fines/student/S1", student, null, 200);
expectStatus("student can't see another student's fines", "GET", "/api/fines/student/S2", student, null, 403);
expectStatus("admin can see any student's fines", "GET", "/api/fines/student/S2", admin, null, 200);
expectStatus("student can't mark a fine paid", "PUT", "/api/fines/3/mark-paid", student, null, 403);
expectStatus("student can't delete an activity", "DELETE", "/api/activities/7", student, null, 403);
expectStatus("student can't list students", "GET", "/api/auth/students", student, null, 403);
expectStatus("student can't view another passport", "GET", "/api/passport/S2", student, null, 403);
expectStatus("student can't send notifications", "POST", "/api/notifications", student, { title: "x", message: "y" }, 403);
expectStatus("student can't see activity QR codes", "GET", "/api/activities/7/qrcodes", student, null, 403);
expectStatus("student can't edit students", "PUT", "/api/auth/students/S2", student, { first_name: "A" }, 403);
expectStatus("student can't reset passwords", "PUT", "/api/auth/students/S2/reset-password", student, null, 403);
expectStatus("student can't run reports", "GET", "/api/reports/activities", student, null, 403);
expectStatus("student can't change settings", "PUT", "/api/settings", student, { fine_per_missed_scan: 0 }, 403);
expectStatus("student can read settings", "GET", "/api/settings", student, null, 200);

// ---- QR codes and points -----------------------------------------------
test("student QR is always for the logged-in student", async () => {
  const r = await call("POST", "/api/auth/student-qr-token", student, { student_id: "S2", user_id: 99 });
  assert.equal(r.status, 200);
  const d = jwt.decode(r.json.token);
  assert.equal(d.student_id, "S1");
  assert.equal(d.full_name, "Ana Cruz");
});
test("admin gets two fresh activity QR codes", async () => {
  const r = await call("GET", "/api/activities/7/qrcodes", admin);
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 2);
  assert.ok(jwt.decode(r.json[0].qr_token).exp > Date.now() / 1000);
});
expectStatus("no points without being timed in", "POST", "/api/participation/scan", student, { token: activityQR }, 403, { timedIn: false });
expectStatus("points after being timed in", "POST", "/api/participation/scan", student, { token: activityQR }, 200, { timedIn: true });
expectStatus("officers only can scan attendance", "POST", "/api/attendance/scan", student, { token: studentQR, day_id: 3 }, 403);
expectStatus("no attendance scanning outside the sportfest day", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3 }, 400, { today: 0 });
expectStatus("time-in on the sportfest day", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3 }, 200, { today: 1 });
expectStatus("second scan too soon is refused", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3 }, 400, { today: 1, existing: true });

// ---- offline-first sync (scans saved on the phone, sent later) ------------
const nowSec = Math.floor(Date.now() / 1000);
// A student QR that was valid 10 minutes ago and has expired since.
const oldStudentQR = jwt.sign({ type: "SPORTPASS_ATTENDANCE_QR", student_id: "S1", full_name: "Ana Cruz", iat: nowSec - 600, exp: nowSec - 300 }, S);
const oldActivityQR = jwt.sign({ type: "SPORTPASS_ACTIVITY_QR", activity_id: 7, qr_type: "participation", iat: nowSec - 600, exp: nowSec - 480 }, S);
const ago = (sec) => new Date(Date.now() - sec * 1000).toISOString();
const cid = (n) => `scan-test-${n}-${Date.now()}`;

expectStatus("live scan of an expired QR is refused", "POST", "/api/attendance/scan", admin, { token: oldStudentQR, day_id: 3 }, 400, { today: 1 });
test("offline scan made while the QR was valid is accepted with the scan time", async () => {
  scenario = { today: 1 };
  queries.length = 0;
  const scannedAt = ago(500);
  const r = await call("POST", "/api/attendance/scan", admin, { token: oldStudentQR, day_id: 3, scanned_at: scannedAt, client_id: cid(1) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.offline, true);
  const insert = queries.find((q) => /INSERT INTO daily_attendance/.test(q.sql));
  assert.ok(insert, "time-in was recorded");
  assert.equal(new Date(insert.params[2]).toISOString(), scannedAt, "time-in uses the scan time");
  assert.ok(queries.some((q) => /INSERT IGNORE INTO offline_scans/.test(q.sql)), "scan id remembered");
});
expectStatus("offline scan made after the QR expired is refused", "POST", "/api/attendance/scan", admin, { token: oldStudentQR, day_id: 3, scanned_at: ago(200), client_id: cid(2) }, 400, { today: 1 });
expectStatus("offline scans older than 48 hours are refused", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3, scanned_at: ago(49 * 3600), client_id: cid(3) }, 400, { today: 1 });
expectStatus("offline scans with a future time are refused", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3, scanned_at: ago(-3600), client_id: cid(4) }, 400, { today: 1 });
expectStatus("offline scans need a scan id", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3, scanned_at: ago(10) }, 400, { today: 1 });
test("sending the same saved scan twice records it once", async () => {
  scenario = { today: 1, seen: true };
  queries.length = 0;
  const r = await call("POST", "/api/attendance/scan", admin, { token: oldStudentQR, day_id: 3, scanned_at: ago(500), client_id: cid(5) });
  assert.equal(r.status, 200);
  assert.equal(r.json.duplicate, true);
  assert.ok(!queries.some((q) => /daily_attendance/.test(q.sql)), "nothing recorded again");
});
test("offline points wait (retry) until the time-in has synced", async () => {
  scenario = { timedIn: false };
  queries.length = 0;
  const r = await call("POST", "/api/participation/scan", student, { token: oldActivityQR, scanned_at: ago(500), client_id: cid(6) });
  assert.equal(r.status, 409, JSON.stringify(r.json));
  assert.equal(r.json.retry, true);
  assert.ok(!queries.some((q) => /INSERT IGNORE INTO offline_scans/.test(q.sql)), "retry answers are not remembered");
});
expectStatus("offline points are added once timed in", "POST", "/api/participation/scan", student, { token: oldActivityQR, scanned_at: ago(500), client_id: cid(7) }, 200, { timedIn: true });

expectStatus("scans after the day's closing time are refused", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3 }, 400, { today: 1, afterClosing: true });
expectStatus("closing time must be HH:MM", "PUT", "/api/attendance/days/3", admin, { closes_at: "5pm" }, 400);
expectStatus("admin sets a closing time", "PUT", "/api/attendance/days/3", admin, { closes_at: "17:00" }, 200);
expectStatus("admin adds a day with a closing time", "POST", "/api/attendance/days", admin, { sportfest_date: "2030-01-16", closes_at: "16:30" }, 200, { past: false });

// ---- closing time ------------------------------------------------------------
expectStatus("scans after the day's closing time are refused", "POST", "/api/attendance/scan", admin, { token: studentQR, day_id: 3 }, 400, { today: 1, afterClosing: true });
expectStatus("closing time must be HH:MM", "PUT", "/api/attendance/days/3", admin, { closes_at: "5pm" }, 400);
expectStatus("admin sets a closing time", "PUT", "/api/attendance/days/3", admin, { closes_at: "17:00" }, 200);
expectStatus("admin adds a day with a closing time", "POST", "/api/attendance/days", admin, { sportfest_date: "2030-01-16", closes_at: "16:30" }, 200, { past: false });

// ---- partial payments ----------------------------------------------------------
test("a partial payment leaves a balance", async () => {
  scenario = { paid: 0 };
  const r = await call("POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: 20, note: "Paid 20 at the booth" });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.payment_status, "partial");
  assert.equal(r.json.balance, 40);
});
test("paying the rest settles the fine", async () => {
  scenario = { paid: 20 };
  const r = await call("POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: 40 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.payment_status, "paid");
});
expectStatus("paying more than the balance is refused", "POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: 50 }, 400, { paid: 20 });
expectStatus("a fully paid fine can't be paid again", "POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: 5 }, 400, { paid: 60 });
expectStatus("no payments while the day is still open", "POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: 10 }, 400, { over: 0 });
expectStatus("payment amount must be positive", "POST", "/api/fines/payments", admin, { student_id: "S1", day_id: 3, amount: -5 }, 400);
expectStatus("students can't record payments", "POST", "/api/fines/payments", student, { student_id: "S1", day_id: 3, amount: 10 }, 403);
expectStatus("student can see own payment history", "GET", "/api/fines/payments/S1?day_id=3", student, null, 200);
expectStatus("student can't see another's payments", "GET", "/api/fines/payments/S2?day_id=3", student, null, 403);

// ---- registration: school email only -------------------------------------------
async function register(email) {
  const { port } = server.address();
  const fd = new FormData();
  const fields = { student_id: "202611016", first_name: "Maria", last_name: "Santos", email, password: "password123",
    year_level: "1st Year", gender: "Female", section: "A", contact: "09171234567" };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append("profile_photo", new Blob([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }), "me.png");
  const res = await fetch(`http://127.0.0.1:${port}/api/auth/register`, { method: "POST", body: fd });
  return { status: res.status, json: await res.json().catch(() => null) };
}
test("registration refuses non-school emails", async () => {
  scenario = {};
  const r = await register("maria.santos@gmail.com");
  assert.equal(r.status, 400);
  assert.match(r.json.message, /school email/);
});
test("registration accepts a school email", async () => {
  scenario = {};
  const r = await register("santos.maria@cec.edu.ph");
  assert.notEqual(r.status, 400, JSON.stringify(r.json));
});

// ---- sportfest days ----------------------------------------------------------
expectStatus("student can't add a sportfest day", "POST", "/api/attendance/days", student, { sportfest_date: "2030-01-15" }, 403);
expectStatus("admin adds a sportfest day", "POST", "/api/attendance/days", admin, { sportfest_date: "2030-01-15", title: "Opening Day" }, 200, { past: false });
expectStatus("past dates can't become sportfest days", "POST", "/api/attendance/days", admin, { sportfest_date: "2020-01-15" }, 400, { past: true });
expectStatus("a sportfest day needs a date", "POST", "/api/attendance/days", admin, { title: "No date" }, 400);
expectStatus("admin closes a sportfest day", "PUT", "/api/attendance/days/3", admin, { status: "closed" }, 200);
expectStatus("day status must be open or closed", "PUT", "/api/attendance/days/3", admin, { status: "finished" }, 400);
expectStatus("day with scans can't be removed", "DELETE", "/api/attendance/days/3", admin, null, 400, { records: 5 });
expectStatus("day without scans can be removed", "DELETE", "/api/attendance/days/3", admin, null, 200, { records: 0 });
expectStatus("anyone logged in can list sportfest days", "GET", "/api/attendance/days", student, null, 200);
expectStatus("student can't see a day's attendance list", "GET", "/api/attendance/day/3", student, null, 403);

// ---- students, settings, passwords ---------------------------------------
expectStatus("admin can edit a student", "PUT", "/api/auth/students/S2", admin, { first_name: "A", last_name: "B", email: "a@b.c", year_level: "1st Year", course: "BSIT" }, 200);
expectStatus("delete refused when the student has records", "DELETE", "/api/auth/students/S2", admin, null, 400, { records: 3 });
const activity = { sport_name: "Chess", activity_name: "Finals", activity_date: "2030-01-15", participation_points: 10, accomplishment_points: 20 };
expectStatus("activity must be on a sportfest day", "POST", "/api/activities", admin, activity, 400, { isDay: false });
expectStatus("activity on a sportfest day is created", "POST", "/api/activities", admin, activity, 200, { isDay: true });
expectStatus("activity with records can't be deleted", "DELETE", "/api/activities/7", admin, null, 400, { records: 2 });
expectStatus("activity without records can be deleted", "DELETE", "/api/activities/7", admin, null, 200, { records: 0 });
expectStatus("delete allowed for a student without records", "DELETE", "/api/auth/students/S2", admin, null, 200, { records: 0 });
expectStatus("settings reject an invalid value", "PUT", "/api/settings", admin, { activity_qr_ttl_seconds: 5 }, 400);
expectStatus("admin can save settings", "PUT", "/api/settings", admin, { fine_per_missed_scan: 25 }, 200);
test("admin password reset returns a temporary password", async () => {
  const r = await call("PUT", "/api/auth/students/S2/reset-password", admin);
  assert.equal(r.status, 200);
  assert.equal(r.json.temporary_password.length, 10);
});
expectStatus("new password must be 8+ characters", "POST", "/api/auth/change-password", student, { current_password: "x", new_password: "short" }, 400);
test("login error doesn't reveal whether the email exists", async () => {
  const r = await call("POST", "/api/auth/login", null, { email: "nobody@x", password: "x" });
  assert.equal(r.status, 400);
  assert.equal(r.json.message, "Incorrect email or password.");
});

// ---- profile photos (stored in the database) ----------------------------
test("profile photo is served from the database", async () => {
  scenario = { photo: true };
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/uploads/123-456.png`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal((await res.arrayBuffer()).byteLength, 4);
});
test("unknown photo name is not found", async () => {
  scenario = { photo: false };
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/uploads/nothing-here.png`);
  assert.equal(res.status, 404);
});
