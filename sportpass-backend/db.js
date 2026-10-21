const fs = require("fs");
const mysql = require("mysql2");
require("dotenv").config();

/*
 * MySQL connection pool. Works the same on Laragon (localhost) and on a
 * cloud database such as Aiven:
 *
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME  the usual login
 *   DB_SSL=true            use an encrypted connection (Aiven requires it)
 *   DB_SSL_CA              the provider's CA certificate (paste the whole
 *                          text), or DB_SSL_CA_FILE = path to the .pem file
 *   DB_TIMEZONE            UTC offset for NOW() and CURDATE() (default +08:00)
 *
 * The time zone matters: cloud servers run on UTC, so without it "today"
 * would be the wrong day in the Philippines before 8 AM, and sportfest-day
 * scanning would be refused.
 */

const DB_TIMEZONE = process.env.DB_TIMEZONE || "+08:00";

function sslOptions() {
  if (String(process.env.DB_SSL).toLowerCase() !== "true") return undefined;

  let ca = process.env.DB_SSL_CA;
  if (!ca && process.env.DB_SSL_CA_FILE) {
    ca = fs.readFileSync(process.env.DB_SSL_CA_FILE, "utf8");
  }
  if (ca) {
    // Hosting dashboards sometimes store line breaks as "\n".
    return { ca: ca.replace(/\\n/g, "\n"), rejectUnauthorized: true };
  }

  console.log(
    "DB_SSL is on but no CA certificate was given: the connection is encrypted but the server's certificate is not verified. Set DB_SSL_CA to fix this."
  );
  return { rejectUnauthorized: false };
}

const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: sslOptions(),
  // How DATETIME values are turned into JavaScript dates.
  timezone: DB_TIMEZONE,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  enableKeepAlive: true,
});

// Every new connection uses Philippine time for NOW() and CURDATE().
db.on("connection", (conn) => {
  conn.query("SET time_zone = ?", [DB_TIMEZONE], (err) => {
    if (err) console.log("Could not set the database time zone:", err.message);
  });
});

db.getConnection((err, conn) => {
  if (err) {
    console.log("Database connection failed:", err.message);
    return;
  }
  console.log(`MySQL connected (time zone ${DB_TIMEZONE})`);
  conn.release();
});

module.exports = db;
