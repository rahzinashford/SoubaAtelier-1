import { storage } from "../storage.js";
import { verifyToken } from "../utils/jwt.js";

/**
 * Verifies JWT and attaches user to req.user
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const decoded = verifyToken(token);

    if (!decoded || !decoded.id || typeof decoded.tokenVersion !== "number") {
      return res.status(401).json({ error: "Invalid token" });
    }

    const user = await storage.getUserAuthSnapshot(decoded.id);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (decoded.tokenVersion !== user.tokenVersion) {
      return res.status(401).json({ error: "Session invalidated" });
    }

    req.user = {
      id: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}

/**
 * Allows only ADMIN users
 * MUST be used AFTER requireAuth
 */
export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}
