const jwt = require("jsonwebtoken");

// Login tokens carry this type. QR tokens use different types, so a QR code
// can never be used as a login, and a login token can never be used as a QR.
const SESSION_TOKEN_TYPE = "SPORTPASS_SESSION";

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in to continue." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== SESSION_TOKEN_TYPE) {
      throw new Error("Not a session token");
    }

    if (decoded.role === "student" && !decoded.student_id) {
      throw new Error("Student session without student ID");
    }

    req.user = {
      user_id: decoded.user_id,
      role: decoded.role,
      student_id: decoded.student_id || null,
    };

    next();
  } catch {
    return res
      .status(401)
      .json({ message: "Your session has expired. Please log in again." });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Only administrators can do this." });
  }
  next();
}

function requireStudent(req, res, next) {
  if (req.user?.role !== "student" || !req.user.student_id) {
    return res.status(403).json({ message: "Only students can do this." });
  }
  next();
}

// Students may only read their own records; admins may read anyone's.
function selfOrAdmin(paramName = "student_id") {
  return (req, res, next) => {
    if (req.user?.role === "admin") return next();

    if (String(req.params[paramName]) === String(req.user?.student_id)) {
      return next();
    }

    return res
      .status(403)
      .json({ message: "You can only view your own records." });
  };
}

module.exports = {
  SESSION_TOKEN_TYPE,
  requireAuth,
  requireAdmin,
  requireStudent,
  selfOrAdmin,
};
