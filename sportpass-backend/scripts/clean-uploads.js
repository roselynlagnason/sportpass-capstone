/*
 * Finds profile photos in uploads/ that no student uses any more
 * (left over from tests, failed registrations or changed photos).
 *
 *   npm run clean-uploads            lists them, deletes nothing
 *   npm run clean-uploads -- --delete   deletes them
 *
 * Photos that a student's record points to are never touched.
 */
const fs = require("fs");
const path = require("path");
process.chdir(path.join(__dirname, ".."));
const db = require("../db");

const shouldDelete = process.argv.includes("--delete");
const dir = path.resolve("uploads");

db.query(
  "SELECT profile_photo FROM students WHERE profile_photo IS NOT NULL AND profile_photo <> ''",
  (err, rows) => {
    if (err) {
      console.error("Could not read students from the database:", err.message);
      process.exit(1);
    }

    const used = new Set(rows.map((r) => r.profile_photo));
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith("."));
    const unused = files.filter((f) => !used.has(f));

    console.log(`${files.length} photo(s) in uploads/, ${used.size} used by students, ${unused.length} unused.`);

    if (unused.length === 0) return db.end(() => process.exit(0));

    let freed = 0;
    for (const f of unused) {
      const size = fs.statSync(path.join(dir, f)).size;
      freed += size;
      if (shouldDelete) {
        fs.unlinkSync(path.join(dir, f));
        console.log(`  deleted  ${f}  (${Math.round(size / 1024)} KB)`);
      } else {
        console.log(`  unused   ${f}  (${Math.round(size / 1024)} KB)`);
      }
    }

    console.log(
      shouldDelete
        ? `Freed ${Math.round(freed / 1024)} KB.`
        : `Run "npm run clean-uploads -- --delete" to remove them (${Math.round(freed / 1024)} KB).`
    );
    db.end(() => process.exit(0));
  }
);
