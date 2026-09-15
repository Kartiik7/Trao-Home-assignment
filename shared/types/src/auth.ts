// ─── Auth Types & Zod Schemas ───

import { z } from "zod";

/** Authenticated user (returned by API, never includes password). */
export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}

/** Input shape for registration. */
export interface RegisterInput {
  email: string;
  password: string;
}

/** Input shape for login. */
export interface LoginInput {
  email: string;
  password: string;
}

// ─── Zod Schemas ───

export const RegisterInputSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters"),
});

export const LoginInputSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .transform((e) => e.toLowerCase().trim()),
  password: z
    .string()
    .min(1, "Password is required"),
});
