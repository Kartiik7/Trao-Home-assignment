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
 */
export async function generateKitDraft(
  jdText: string,
  research: ResearchResult
): Promise<DraftResult> {
  const log: GenerationLogEntry[] = [];
  
  // 1. Concurrent initial steps
  const [reqRes, briefRes] = await Promise.all([
    extractRequirements(jdText),
    generateCompanyBrief(research.pages)
  ]);

  if (!reqRes.ok) {
    log.push({ step: "extractRequirements", success: false, reason: reqRes.reason });
    return { draft: null, log };
  }
  log.push({ step: "extractRequirements", success: true });

  if (!briefRes.ok) {
    log.push({ step: "generateCompanyBrief", success: false, reason: briefRes.reason });
    return { draft: null, log };
  }
  log.push({ step: "generateCompanyBrief", success: true });

  const requirements = reqRes.data;
  const brief = reqRes.data ? { ...briefRes.data, _meta: { origin: "generated" as const, pinned: false } } : briefRes.data;

  // Compile hiring process context from search discussion
  const hiringProcessContext = research.discussion
    .map(d => `${d.source}: ${d.snippet}`)
    .join("\n");

  // 2. Loop questions sequentially or in bounded parallel
  // Doing it concurrently here for speed, but independently isolated
  const questions: Question[] = [];
  const qPromises = requirements.map(async (req) => {
    const qRes = await generateQuestionsForRequirement(req, hiringProcessContext);
    if (qRes.ok) {
      const withMeta = qRes.data.map(q => ({ ...q, _meta: { origin: "generated" as const, pinned: false } }));
      questions.push(...withMeta);
      log.push({ step: `generateQuestions_${req.id}`, success: true });
    } else {
      log.push({ step: `generateQuestions_${req.id}`, success: false, reason: qRes.reason });
    }
  });

  await Promise.all(qPromises);

  // 3. Generate flashcards
  const flashRes = await generateFlashcards(requirements, questions);
  let flashcards: Flashcard[] = [];
  if (flashRes.ok) {
    flashcards = flashRes.data.map(f => ({ ...f, _meta: { origin: "generated" as const, pinned: false } }));
    log.push({ step: "generateFlashcards", success: true });
  } else {
    log.push({ step: "generateFlashcards", success: false, reason: flashRes.reason });
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
