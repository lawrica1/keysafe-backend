import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_key_keysafe";

/**
 * Authentication Middleware: Verifies Bearer JWT token in Authorization header
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required (Bearer token)" });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    
    // Attach decoded user information to request object
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      fullName: decoded.fullName
    };
    next();
  });
}

/**
 * Role Check Middleware: Restricts access to Admin only
 */
export function isAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admin access only" });
  }
  
  next();
}

/**
 * Role Check Middleware: Restricts access to Staff or Admin
 */
export function isStaffOrAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  if (req.user.role !== "staff" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden: Staff or Admin access only" });
  }
  
  next();
}
