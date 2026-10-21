# SPORTPASS

A web application for student performance tracking and activity management
during the Cristal e-College Computer Studies Sportfest.

- **Students** register, show a refreshing QR code for time-in/time-out, scan
  activity QR codes to earn participation and accomplishment points, and see
  their Digital Sportfest Passport, performance, ranking, fines and
  notifications.
- **Administrators** manage students and activities, scan attendance, monitor
  and collect fines, send notifications, generate reports and change settings.

| Part | Folder | Built with |
|---|---|---|
| Web app (presentation layer) | `sportpass-frontend/` | React, TypeScript, Vite, Tailwind CSS |
| API (application layer) | `sportpass-backend/` | Node.js, Express, JWT, bcrypt |
| Database (data layer) | MySQL | `sportpass_db` |

## Setup

Requirements: Node.js 18 or newer, MySQL 8 (or XAMPP's MariaDB).

1. **Database**
   - New install: run `sportpass-backend/database/schema.sql` (creates
     `sportpass_db` and every table), then `database/seed-admin.sql` for the
     first admin account (`admin@sportpass.local` / `ChangeMe@2026` — change it
     after logging in). In phpMyAdmin: Import each file in that order.
   - Existing database: nothing to do. When the API starts it adds anything
     newer automatically (see `sportpass-backend/migrations/`).
2. **API**
   ```
   cd sportpass-backend
   copy .env.example .env      (then edit .env: database login and JWT_SECRET)
   npm install
   npm run dev                 (or: npm start)
   ```
   The API runs on http://localhost:5000.
3. **Web app**
   ```
   cd sportpass-frontend
   npm install
   npm run dev
   ```
   Open the address Vite prints (usually http://localhost:5173).

To use a different API address (for example on the school server), create
`sportpass-frontend/.env` with `VITE_API_URL=https://your-server` and run
`npm run build`; the site is in `sportpass-frontend/dist/`.

## Deploying online

See [DEPLOY.md](DEPLOY.md): GitHub, an Aiven MySQL database, the API on
Render and the web app on Vercel, with the exact settings for each.

## Tests

```
cd sportpass-backend
npm test
```

Runs 50 automated checks on logins, role permissions, QR codes, attendance
rules, settings and password handling. They use a stand-in database, so MySQL
doesn't need to be running.

## Maintenance

Remove profile photos no student uses any more (left over from tests or
changed photos). It lists them first and deletes only when asked:

```
cd sportpass-backend
npm run clean-uploads
npm run clean-uploads -- --delete
```

## How it works

**Logins and roles.** Logging in returns a token that the web app sends with
every request. The API checks it on every route: students can only read their
own records; only administrators can change data, scan attendance, see all
fines, run reports and change settings.

**Sportfest days.** The officers decide which dates are sportfest days. An
administrator adds each one on the Sportfest Days calendar (today or later),
optionally with a title, and students can be notified automatically. A day can
be closed early to make its fines final, and removed if nobody was scanned.

**Attendance (officers scan students, once per sportfest day).** Each student's
QR code is signed by the server for that student only and refreshes every few
minutes, so screenshots stop working. An administrator picks the sportfest day
and scans the code: the first scan is time-in, the next is time-out. Scans only
work on the day itself while it is open, and a second scan too soon after
time-in is refused.

**Points (students scan activities).** Each activity has a participation QR and
an accomplishment QR shown on the administrator's screen. They refresh every
couple of minutes. A student only earns points if an officer has timed them in
on that activity's sportfest day.

**Fines.** One rule everywhere: each missed scan (time-in or time-out) costs the
"fine per missed scan" setting (default ₱30) per sportfest day; missing the
whole day counts as two missed scans (₱60). A day's fines count once it is
closed or its date has passed. Administrators mark fines as paid; payments themselves happen outside
the system.

**Rewards.** Rank is by total points; students with equal points share a rank.
The top ranks get placement titles (Overall Champion, First and Second
Runner-Up), students at or above the High Performer threshold are High
Performers, and anyone with points is an Active Participant. Both numbers are
set on the Settings page.

**Settings.** Stored in the `system_settings` table: event details, default
points, fine amount, reward thresholds, QR lifetimes, the minimum time before
time-out, and automatic activity notifications.

## Folder guide

```
sportpass-backend/
  server.js            starts the API, applies database updates, loads settings
  db.js                MySQL connection pool
  middleware/auth.js   login and role checks
  middleware/upload.js profile photo uploads (JPG/PNG/WebP, max 2 MB)
  lib/fines.js         the fine rules (one place)
  lib/settings.js      settings defaults and validation
  lib/migrate.js       automatic database updates
  database/            schema.sql (all tables) + seed-admin.sql
  scripts/             clean-uploads.js
  routes/              one file per module
  tests/api.test.js    automated tests
sportpass-frontend/src/app/
  App.tsx              screens by role
  lib/api.ts           API address + login token
  lib/reports.ts       CSV and printable (PDF) reports
  lib/rewards.ts       reward eligibility
  components/          one file per screen
```
