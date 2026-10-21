const multer = require("multer");
const path = require("path");

// Profile photos only: JPG, PNG or WebP, up to 2 MB.
// Photos are kept in memory and saved in the database (students.photo_data),
// because cloud hosts such as Render wipe their disk on every restart.
const ALLOWED = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED[ext] && ALLOWED[ext] === file.mimetype) {
      return cb(null, true);
    }
    cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
  },
});

// A unique file name for the photo; the web app shows it from /uploads/<name>.
upload.photoName = (file) =>
  `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`;

// Wraps upload.single() so a bad file returns a clear JSON message
// instead of a server error page.
upload.singlePhoto = (field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();

    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "Profile photo must be 2 MB or smaller."
        : "Profile photo must be a JPG, PNG or WebP image.";

    return res.status(400).json({ message });
  });
};

module.exports = upload;
