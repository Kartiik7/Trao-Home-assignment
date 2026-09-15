import { z } from "zod";
import type { Kit } from "./kit";

// ─── Zod Schemas mirroring kit.ts interfaces ───

export const ItemMetaSchema = z.object({
  origin: z.enum(["generated", "edited", "manual"]),
  pinned: z.boolean(),
});

export const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
  _meta: ItemMetaSchema.optional(),
});

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});

export const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

export const QuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number(),
  _meta: ItemMetaSchema.optional(),
});

export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
  _meta: ItemMetaSchema.optional(),
});

export const ScheduleDaySchema = z.object({
  day: z.number(),
  focus: z.string(),
  question_ids: z.array(z.string()),
  minutes: z.number(),
});

export const ScheduleSchema = z.object({
  days_available: z.number(),
  days: z.array(ScheduleDaySchema),
});

export const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number(),
});

export const KitSchema = z.object({
  source: SourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleSchema,
  questions: z.array(QuestionSchema),
  flashcards: z.array(FlashcardSchema),
  schedule: ScheduleSchema,
  coverage: CoverageSchema,
});

// ─── Validator function ───

export type ValidateKitSuccess = { valid: true; data: Kit };
export type ValidateKitFailure = { valid: false; errors: z.ZodError };
export type ValidateKitResult = ValidateKitSuccess | ValidateKitFailure;

/**
 * Validates an unknown object against the Kit schema.
 * Returns `{ valid: true, data }` on success, or `{ valid: false, errors }` on failure.
 */
export function validateKit(obj: unknown): ValidateKitResult {
  const result = KitSchema.safeParse(obj);
  if (result.success) {
    return { valid: true, data: result.data as Kit };
  }
  return { valid: false, errors: result.error };
}
