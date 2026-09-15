// ─── Appendix A: Kit Structure ───
// Field names match the assignment JSON exactly.

export interface ItemMeta {
  origin: "generated" | "edited" | "manual";
  pinned: boolean;
}

/** Source metadata about the job posting and research. */
export interface Source {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

/** Brief company overview gathered from research. */
export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  _meta?: ItemMeta; // Added in Phase 6 for provenance tracking
}

/** A single requirement extracted from the job description. */
export interface Requirement {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
}

/** The role section of the kit. */
export interface Role {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

/** An interview prep question linked to one or more requirements. */
export interface Question {
  id: string;
  requirement_ids: string[];
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: number;
  _meta?: ItemMeta; // Added in Phase 6 for provenance tracking
}

/** A flashcard for quick revision. */
export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  _meta?: ItemMeta; // Added in Phase 6 for provenance tracking
}

/** A single day in the study schedule. */
export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
}

/** The overall study schedule. */
export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

/** Coverage analysis of how well questions cover requirements. */
export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

/** The complete Interview Prep Kit — top-level structure from Appendix A. */
export interface Kit {
  source: Source;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
}
