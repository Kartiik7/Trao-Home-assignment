import jwt from "jsonwebtoken";
import { Response } from "express";
import { User, IUser } from "../models/User";
import type { AuthUser } from "@ai-interview-prep/types";

const JWT_SECRET = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not defined in environment variables");
  return secret;
};

const TOKEN_EXPIRY = "7d";
const COOKIE_NAME = "token";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

// ─── Token helpers ───

/** Sign a JWT containing the userId. */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET(), { expiresIn: TOKEN_EXPIRY });
}

/** Verify and decode a JWT. Returns the payload or throws. */
export function verifyToken(token: string): { userId: string } {
  return jwt.verify(token, JWT_SECRET()) as { userId: string };
}

// ─── Cookie helpers ───

/** Set the JWT as an httpOnly cookie on the response. */
export function setAuthCookie(res: Response, token: string): void {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,            // must be true when sameSite is 'none'
    sameSite: isProd ? "none" : "lax", // 'none' required for cross-site (Netlify → Render)
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

/** Clear the auth cookie. */
export function clearAuthCookie(res: Response): void {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  });
}

// ─── Auth operations ───

/**
 * Register a new user. Throws if email already exists.
 */
export async function registerUser(
  email: string,
  password: string
): Promise<AuthUser> {
  // Check for existing user
  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error("A user with this email already exists");
    (err as any).statusCode = 409;
    throw err;
  }

  const user = await User.create({ email, password });
  return user.toAuthUser();
}

/**
 * Verify credentials and return the AuthUser. Throws on invalid credentials.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthUser> {
  const user = await User.findOne({ email });
  if (!user) {
    const err = new Error("Invalid email or password");
    (err as any).statusCode = 401;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error("Invalid email or password");
    (err as any).statusCode = 401;
    throw err;
  }

  return user.toAuthUser();
}

/**
 * Fetch a user by ID and return as AuthUser. Returns null if not found.
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const user = await User.findById(userId);
  return user ? user.toAuthUser() : null;
}
