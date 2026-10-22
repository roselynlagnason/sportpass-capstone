/*
 * Offline-first scanning.
 *
 * When a phone has no internet, the website saves each scan on the phone
 * together with the time it was scanned (scanned_at) and a unique scan id
 * (client_id). When the connection returns, the saved scans are sent here.
 *
 * - The QR code is checked as of the moment it was scanned, so a code that
 *   was valid then is still accepted after it has expired.
 * - The scan id makes sending the same scan twice harmless: the second time
 *   the first answer is returned and nothing is recorded again.
 */
const db = require("../db");

// Saved scans older than this are refused (the sportfest is over by then).
const MAX_OFFLINE_HOURS = 48;
// Allowance for a phone clock that is a few minutes fast.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Reads the offline fields. Live scans return { offline: false }. */
function readOfflineScan(body) {
  const { scanned_at, client_id } = body || {};
  if (!scanned_at) return { offline: false, at: null };

  const at = new Date(scanned_at);
  if (Number.isNaN(at.getTime())) {
    return { error: "This saved scan has an invalid time." };
  }
  const now = Date.now();
  if (at.getTime() > now + FUTURE_TOLERANCE_MS) {
    return { error: "This saved scan has a time in the future. Check the phone's date and time." };
  }
  if (now - at.getTime() > MAX_OFFLINE_HOURS * 3600 * 1000) {
    return {
      error: `This scan was saved offline more than ${MAX_OFFLINE_HOURS} hours ago and can no longer be synced.`,
    };
  }
  if (!client_id || !/^[A-Za-z0-9_-]{8,64}$/.test(String(client_id))) {
    return { error: "This saved scan is missing its scan id." };
  }
  return { offline: true, at, clientId: String(client_id) };
}

/** jwt.verify options that check the QR as of the scan time. */
function verifyOptionsFor(scan) {
  return scan.offline ? { clockTimestamp: Math.floor(scan.at.getTime() / 1000) } : undefined;
}

/**
 * Express middleware for the scan routes. For a saved (offline) scan it
 * - refuses bad scan times,
 * - answers a repeated scan id with the answer it got the first time,
 * - remembers the final answer for this scan id.
 * Answers marked { retry: true } are not remembered, so the phone can try again.
 */
function offlineScan(kind) {
  return (req, res, next) => {
    const scan = readOfflineScan(req.body);
    if (scan.error) return res.status(400).json({ message: scan.error, offline: true });
    req.scan = scan;
    if (!scan.offline) return next();

    db.query(
      "SELECT status_code, response FROM offline_scans WHERE client_id = ?",
      [scan.clientId],
      (err, rows) => {
        if (!err && Array.isArray(rows) && rows.length > 0) {
          let body = {};
          try {
            body = JSON.parse(rows[0].response);
          } catch {
            /* keep empty */
          }
          return res.status(Number(rows[0].status_code) || 200).json({ ...body, duplicate: true });
        }

        const send = res.json.bind(res);
        res.json = (body) => {
          if (res.statusCode < 500 && !(body && body.retry)) {
            db.query(
              `INSERT IGNORE INTO offline_scans (client_id, kind, user_id, status_code, response, scanned_at)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [
                scan.clientId,
                kind,
                req.user ? req.user.user_id : null,
                res.statusCode,
                JSON.stringify(body || {}),
                scan.at,
              ],
              (saveErr) => {
                if (saveErr) console.error("Could not remember offline scan:", saveErr.message);
              }
            );
          }
          return send({ ...(body || {}), offline: true });
        };
        next();
      }
    );
  };
}

module.exports = { offlineScan, verifyOptionsFor, readOfflineScan, MAX_OFFLINE_HOURS };
