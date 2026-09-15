import { z } from "zod";
import { KitSchema } from "./kit.schema";

// ─── Zod Schemas for Batch Input/Output (Appendix B) ───

export const BatchInputCaseSchema = z.object({
  id: z.string(),
  jd: z.string(),
  company_url: z.string(),
  days: z.number(),
});

export const BatchInputSchema = z.array(BatchInputCaseSchema);

export const BatchOutputErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const BatchOutputKitSchema = z.object({
  id: z.string(),
  status: z.enum(["ok", "failed"]),
  kit: KitSchema.nullable(),
  error: BatchOutputErrorSchema.nullable(),
});

export const BatchOutputSchema = z.object({
  version: z.string(),
  generated_at: z.string(),
  kits: z.array(BatchOutputKitSchema),
});
