const fs = require("fs");
const path = require("path");

const UPLOADS = path.join(__dirname, "..", "uploads");
const TYPES = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/*
 * GET /uploads/:name — a student's profile photo.
 * Served from the database; photos uploaded before October 2026 that are
 * still only on disk fall through to the uploads folder.
 */
function servePhoto(db) {
  return (req, res, next) => {
    db.query(
      "SELECT photo_data, photo_type FROM students WHERE profile_photo = ? AND photo_data IS NOT NULL LIMIT 1",
      [req.params.name],
      (err, rows) => {
        if (err || rows.length === 0) return next();
        res.setHeader("Content-Type", rows[0].photo_type || "image/jpeg");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.send(rows[0].photo_data);
      }
    );
  };
}

// Copies photos that exist only in the uploads folder into the database,
// so they move with the data (e.g. when the database is copied to Aiven).
function copyDiskPhotosToDatabase(db, done = () => {}) {
  db.query(
    "SELECT student_id, profile_photo FROM students WHERE profile_photo IS NOT NULL AND profile_photo <> '' AND photo_data IS NULL",
    (err, rows) => {
      if (err) return done(err);
      let copied = 0;
      const next = () => {
        const row = rows.shift();
        if (!row) {
          if (copied) console.log(`Profile photos: copied ${copied} photo(s) from uploads/ into the database`);
          return done();
        }
        const file = path.join(UPLOADS, path.basename(row.profile_photo));
        const type = TYPES[path.extname(file).toLowerCase()];
        if (!type || !fs.existsSync(file)) return next();
        db.query(
          "UPDATE students SET photo_data = ?, photo_type = ? WHERE student_id = ?",
          [fs.readFileSync(file), type, row.student_id],
          (updErr) => {
            if (!updErr) copied++;
            next();
          }
        );
      };
      next();
    }
  );
}

module.exports = { servePhoto, copyDiskPhotosToDatabase };
