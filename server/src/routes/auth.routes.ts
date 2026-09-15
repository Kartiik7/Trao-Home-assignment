import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import {
  RegisterInputSchema,
  LoginInputSchema,
} from "@ai-interview-prep/types";
import {
  registerUser,
  loginUser,
  getUserById,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
} from "../services/auth.service";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// ─── Rate limiting for auth endpoints ───
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many authentication attempts. Please try again in 15 minutes.",
  },
});

router.use("/register", authLimiter);
router.use("/login", authLimiter);

// ─── POST /auth/register ───
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = RegisterInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation Error",
        message: parsed.error.errors.map((e) => e.message).join(", "),
        details: parsed.error.errors,
      });
      return;
    }

    const { email, password } = parsed.data;
    const user = await registerUser(email, password);

    // Issue JWT cookie
    const token = generateToken(user.id);
    setAuthCookie(res, token);

    res.status(201).json({ user });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 409 ? "Conflict" : "Server Error",
      message: err.message || "Registration failed",
    });
  }
});

// ─── POST /auth/login ───
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Validate input
    const parsed = LoginInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation Error",
        message: parsed.error.errors.map((e) => e.message).join(", "),
        details: parsed.error.errors,
      });
      return;
    }

    const { email, password } = parsed.data;
    const user = await loginUser(email, password);

    // Issue JWT cookie
    const token = generateToken(user.id);
    setAuthCookie(res, token);

    res.json({ user });
  } catch (err: any) {
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 401 ? "Unauthorized" : "Server Error",
      message: err.message || "Login failed",
    });
  }
});

// ─── POST /auth/logout ───
router.post("/logout", (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out" });
});

// ─── GET /auth/me ───
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.userId!);
    if (!user) {
      res.status(401).json({
        error: "Unauthorized",
        message: "User not found",
      });
      return;
    }
    res.json({ user });
  } catch (err: any) {
    res.status(500).json({
      error: "Server Error",
      message: "Failed to fetch user",
    });
  }
});

export default router;
