# Deploying SPORTPASS online

| Part | Service | Address you get |
|---|---|---|
| Database (MySQL) | Aiven for MySQL, free plan | host + port + password |
| API (`sportpass-backend`) | Render, free web service | `https://<name>.onrender.com` |
| Web app (`sportpass-frontend`) | Vercel, free | `https://<name>.vercel.app` |

Do the steps in order: each one needs an address from the step before.
Allow about an hour the first time.

---

## 1. Put the project on GitHub

1. Create a **private** repository on github.com (e.g. `sportpass-capstone`).
   Don't add a README or .gitignore there; the project already has them.
2. In a terminal opened in the `sportpass-capstone` folder:
   ```
   git init
   git add .
   git status
   ```
   Check the list: there must be **no `.env` file, no `node_modules`, no
   `uploads` photos and no `.tar.gz` backup**. `.gitignore` keeps them out.
3. Then:
   ```
   git commit -m "SPORTPASS capstone"
   git branch -M main
   git remote add origin https://github.com/<your-username>/sportpass-capstone.git
   git push -u origin main
   ```
4. Invite your groupmates under Settings > Collaborators.

## 2. Create the database on Aiven

1. Sign up at aiven.io and create a **MySQL** service on the **Free** plan.
2. When it shows **Running**, open its **Overview** page and keep it open.
   You need: **Host**, **Port**, **User** (usually `avnadmin`),
   **Password**, **Database name** (usually `defaultdb`), and the
   **CA certificate** (click to show it, then copy the whole text).

You don't need to create any tables: the API creates them, plus the first
admin account, the first time it connects to the empty database.

> Free databases that sit unused may be powered off by Aiven (you get an
> email first). Power it back on from the Aiven console before a demo.

## 3. Put the API on Render

1. Sign up at render.com with your GitHub account.
2. **New > Web Service**, choose your repository, then set:
   - **Root Directory:** `sportpass-backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance type:** Free
3. Under **Environment**, add these variables:

   | Name | Value |
   |---|---|
   | `DB_HOST` | Aiven Host |
   | `DB_PORT` | Aiven Port |
   | `DB_USER` | Aiven User |
   | `DB_PASSWORD` | Aiven Password |
   | `DB_NAME` | Aiven Database name |
   | `DB_SSL` | `true` |
   | `DB_SSL_CA` | the whole Aiven CA certificate text |
   | `JWT_SECRET` | a new long random value (see below) |
   | `DB_TIMEZONE` | `+08:00` |
   | `APP_TIMEZONE` | `Asia/Manila` |
   | `CORS_ORIGIN` | leave out for now (step 5) |

   Make a new `JWT_SECRET` (don't reuse your laptop's):
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
4. **Create Web Service.** In the **Logs** you should see:
   ```
   MySQL connected (time zone +08:00)
   Database updated: added all SPORTPASS tables (empty database)
     created all tables and the first admin account (admin@sportpass.local)
   Server running on port ...
   ```
5. Copy the service address, e.g. `https://sportpass-api.onrender.com`.
   Opening it in a browser shows "SPORTPASS Backend Running".

> The free API sleeps after 15 minutes without visitors and takes about a
> minute to wake. Open the site a few minutes before anyone tests it.

## 4. Put the web app on Vercel

1. Sign up at vercel.com with your GitHub account.
2. **Add New > Project**, import the repository, then set:
   - **Root Directory:** `sportpass-frontend`
   - **Framework Preset:** Vite (detected automatically)
   - **Environment Variable:** `VITE_API_URL` = the Render address from
     step 3, with no slash at the end
3. **Deploy**, then copy the address, e.g. `https://sportpass.vercel.app`.

## 5. Connect the two

1. On Render, add the environment variable `CORS_ORIGIN` = your Vercel
   address (no slash at the end). Render restarts the API by itself.
2. Open the Vercel address and log in as
   **admin@sportpass.local / ChangeMe@2026**.
3. **Change that password right away** (Settings > Change Password).
4. In **Settings**, check the event details and fine amount.
5. In **Sportfest Days**, add today's date. Then create an activity on it.

## 6. Test the scanner with phones

Phone cameras only work on HTTPS sites; Vercel and Render both use HTTPS.

1. On a phone, open the Vercel address, register a test student and log in.
   Open **My QR Code**.
2. On a laptop (or a second phone) logged in as admin, open
   **Attendance Monitoring**, choose today's sportfest day, **Open Scanner**,
   allow the camera, and scan the student's phone: time-in. Scan again after
   the minimum time (1 minute by default): time-out.
3. As admin, open **Activity Management > QR codes** for today's activity.
   On the student's phone, open **Activity Scanner** and scan it: points.

## 7. Give the panelist access

Send the Vercel address and two test accounts (an admin you created and a
student). Wake the API a few minutes before by opening the site yourself,
and check the Aiven database is running.

## Updating the online version

Commit and push to GitHub. Render and Vercel rebuild by themselves within a
few minutes:
```
git add .
git commit -m "Describe the change"
git push
```
If you change `VITE_API_URL` on Vercel, redeploy the project there so the
new address is built in.

## Optional: copy your Laragon data to Aiven

The online database starts empty apart from the admin account. To bring
your local students, days and activities along, use HeidiSQL (included in
Laragon) **before** the API's first start on Render, or on a fresh Aiven
database:

1. In HeidiSQL, add a session for Aiven: Network type **MariaDB or MySQL
   (SSL)**, the Aiven host, user, password and port; under **SSL**, select a
   file containing the Aiven CA certificate.
2. Right-click your local `sportpass_db` > **Export database as SQL**.
   Tick the tables, choose **Create** for tables and **Insert** for data,
   set **Output** to **Database**, and pick the Aiven session and
   `defaultdb`.
3. Start (or restart) the API on Render. Profile photos were copied into
   the database by your local API, so they come along too.
