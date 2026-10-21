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
    if (/information_schema/.test(sql)) rows = [{ n: 1 }];
    else if (/AS records/.test(sql)) rows = [{ records: scenario.records ?? 0 }];
    else if (/AS is_past/.test(sql)) rows = [{ is_past: scenario.past ? 1 : 0 }];
    else if (/is_today/.test(sql)) rows = [{ is_today: scenario.today ?? 1, status: "ongoing" }];
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
  assert.equal(d.user_id, 5);
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
