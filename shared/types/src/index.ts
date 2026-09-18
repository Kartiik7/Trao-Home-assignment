// ─── Barrel Export ───

// Kit types (Appendix A)
export type {
  Source,
  ItemMeta,
  CompanyBrief,
  Requirement,
  Role,
  Question,
  Flashcard,
  ScheduleDay,
  Schedule,
  Coverage,
  Kit,
} from "./kit";

// Kit Zod schemas & validator
export {
  SourceSchema,
  CompanyBriefSchema,
  RequirementSchema,
  RoleSchema,
  QuestionSchema,
  FlashcardSchema,
  ScheduleDaySchema,
  ScheduleSchema,
  CoverageSchema,
  KitSchema,
  validateKit,
} from "./kit.schema";
export type { ValidateKitResult, ValidateKitSuccess, ValidateKitFailure } from "./kit.schema";

// Batch types (Appendix B)
export type {
  BatchInputCase,
  BatchOutputError,
  BatchOutputKit,
  BatchOutput,
} from "./batch";

// Batch Zod schemas
export {
  BatchInputCaseSchema,
  BatchInputSchema,
  BatchOutputErrorSchema,
  BatchOutputKitSchema,
  BatchOutputSchema,
} from "./batch.schema";

// Auth types (user, login, register)
export type { AuthUser, RegisterInput, LoginInput } from "./auth";

// Auth Zod schemas
export { RegisterInputSchema, LoginInputSchema } from "./auth";
