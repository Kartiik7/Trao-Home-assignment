import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";

// ─── Extend Express Request to include userId ───
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Express middleware that verifies the JWT from the httpOnly cookie.
 * Attaches `req.userId` on success, returns 401 on failure.
 *
 * Apply to any route/router that requires authentication.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication required. Please log in.",
    });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (err: any) {
    const message =
      err.name === "TokenExpiredError"
        ? "Session expired. Please log in again."
        : "Invalid session. Please log in again.";

    res.status(401).json({
      error: "Unauthorized",
      message,
    });
  }
}
