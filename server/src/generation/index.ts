import pLimit from "p-limit";
import crypto from "crypto";
import {
  extractRequirements,
  generateCompanyBrief,
  generateQuestionsForRequirement,
  generateFlashcards,
  Requirement,
  CompanyBrief,
  Question,
  Flashcard,
} from "./steps";
import type { ResearchResult } from "../retrieval";

// ─── Concurrency cap ───
// Limits simultaneous LLM calls to 2 to avoid saturating free-tier
// token-per-minute limits. The exponential backoff on 429 is the second
// layer of defense, but this cap prevents the storm from starting.
const LLM_CONCURRENCY = 2;

// ─── Thin JD threshold ───
// JDs under this length (raw chars) often produce malformed/empty LLM output.
// We fall back to an empty requirements list and log it as 'degraded'.
const MIN_JD_LENGTH = 80;

export interface KitDraft {
  requirements: Requirement[];
  brief: CompanyBrief;
  questions: Question[];
  flashcards: Flashcard[];
}

export interface GenerationLogEntry {
  step: string;
  success: boolean;
  reason?: string;
}

export interface DraftResult {
  draft: KitDraft | null;
  log: GenerationLogEntry[];
}

/**
 * Orchestrates the LLM generation sequence.
 * This does NOT build the final `Kit` persistence object or handle scheduling;
 * it solely orchestrates the LLM tasks to produce the raw data structures.
 *
 * Resilience guarantees:
 * - Thin JDs (< MIN_JD_LENGTH chars or failed extraction) degrade gracefully
 *   to an empty requirements list rather than failing the whole kit.
 * - Per-requirement LLM calls are capped at LLM_CONCURRENCY=2 to prevent
 *   rate-limit storms on free-tier Groq accounts.
 */
export async function generateKitDraft(
  jdText: string,
  research: ResearchResult
): Promise<DraftResult> {
  const log: GenerationLogEntry[] = [];

  // 1. Concurrent initial steps — requirements + brief run in parallel (2 calls)
  const [reqRes, briefRes] = await Promise.all([
    extractRequirements(jdText),
    generateCompanyBrief(research.pages)
  ]);

  // ─── Fix 2: Graceful degradation for thin/sparse JDs ───
  let requirements: Requirement[] = [];
  const isThinJd = jdText.trim().length < MIN_JD_LENGTH;

  if (!reqRes.ok) {
    if (isThinJd) {
      // Thin JD — expected failure. Degrade to empty requirements, continue.
      log.push({
        step: "extractRequirements",
        success: false,
        reason: `DEGRADED: JD too short (${jdText.length} chars < ${MIN_JD_LENGTH}). Falling back to empty requirements.`
      });
    } else {
      // Normal JD that still failed extraction — use empty list but warn.
      log.push({
        step: "extractRequirements",
        success: false,
        reason: `DEGRADED: Failed to extract requirements. Reason: ${reqRes.reason}. Continuing with empty list.`
      });
    }
    // Either way: degrade to empty, never hard-fail here.
    requirements = [];
  } else {
    requirements = reqRes.data;
    log.push({ step: "extractRequirements", success: true });
  }

  // Brief can also degrade — if it fails, produce an honest "unavailable" brief
  const briefData = briefRes.ok
    ? briefRes.data
    : { summary: "Company information could not be retrieved.", what_they_do: "Not available.", sources: [] };

  if (!briefRes.ok) {
    log.push({ step: "generateCompanyBrief", success: false, reason: `DEGRADED: ${briefRes.reason}. Using fallback brief.` });
  } else {
    log.push({ step: "generateCompanyBrief", success: true });
  }

  const brief = { ...briefData, _meta: { origin: "generated" as const, pinned: false } };

  // Compile hiring process context from search discussion
  const hiringProcessContext = research.discussion
    .map(d => `${d.source}: ${d.snippet}`)
    .join("\n");

  // ─── Fix 1: Concurrency-limited per-requirement LLM calls ───
  const limit = pLimit(LLM_CONCURRENCY);
  const questions: Question[] = [];

  if (requirements.length === 0) {
    log.push({ step: "generateQuestions", success: true, reason: "Skipped: no requirements to cover." });
  } else {
    const qPromises = requirements.map(req =>
      limit(async () => {
        const qRes = await generateQuestionsForRequirement(req, hiringProcessContext);
        if (qRes.ok) {
          const withMeta = qRes.data.map(q => ({
            ...q,
            id: `q_${crypto.randomUUID()}`,
            _meta: { origin: "generated" as const, pinned: false }
          }));
          questions.push(...withMeta);
          log.push({ step: `generateQuestions_${req.id}`, success: true });
        } else {
          log.push({ step: `generateQuestions_${req.id}`, success: false, reason: qRes.reason });
        }
      })
    );

    await Promise.all(qPromises);
  }

  // 3. Generate flashcards (only if we have something to condense)
  let flashcards: Flashcard[] = [];
  if (questions.length > 0 || requirements.length > 0) {
    const flashRes = await generateFlashcards(requirements, questions);
    if (flashRes.ok) {
      flashcards = flashRes.data.map(f => ({
        ...f,
        id: `f_${crypto.randomUUID()}`,
        _meta: { origin: "generated" as const, pinned: false }
      }));
      log.push({ step: "generateFlashcards", success: true });
    } else {
      log.push({ step: "generateFlashcards", success: false, reason: flashRes.reason });
    }
  } else {
    log.push({ step: "generateFlashcards", success: true, reason: "Skipped: no requirements or questions to condense." });
  }

  return {
    draft: {
      requirements,
      brief,
      questions,
      flashcards
    },
    log
  };
}

// Re-export for use by other modules (pipeline, routes)
export { generateQuestionsForRequirement, generateCompanyBrief };
