import type { Requirement, Flashcard } from "@ai-interview-prep/types";
import type { PracticeProgressRecord } from "./practice";

export interface WeakRequirement {
  requirement_id: string;
  text: string;
  priority: "must" | "nice";
  kind: "technical" | "behavioural" | "domain";
  avg_confidence: number | null; // null if not yet practiced
  times_practiced: number;
}

export interface WeakSpotsReport {
  weak_requirements: WeakRequirement[];
  unpracticed_must_count: number;
  overall_readiness_pct: number;
}

/**
 * Pure function to analyze weak spots based on practice progress.
 */
export function analyzeWeakSpots(
  requirements: Requirement[],
  flashcards: Flashcard[],
  progressRecords: PracticeProgressRecord[]
): WeakSpotsReport {
  // Map flashcard ID to its progress
  const progressMap = new Map<string, PracticeProgressRecord>();
  for (const record of progressRecords) {
    progressMap.set(record.flashcard_id, record);
  }

  const weakReqs: WeakRequirement[] = [];
  let unpracticed_must_count = 0;
  let mustCount = 0;
  let readyMustCount = 0;

  for (const req of requirements) {
    if (req.priority === "must") mustCount++;

    // Find flashcards covering this requirement
    const coveringCards = flashcards.filter((f) =>
      f.requirement_ids.includes(req.id)
    );

    let totalConfidence = 0;
    let timesPracticed = 0;
    let cardsPracticed = 0;

    for (const card of coveringCards) {
      const record = progressMap.get(card.id);
      if (record && record.times_seen > 0) {
        cardsPracticed++;
        timesPracticed += record.times_seen;
        totalConfidence += record.last_confidence;
      }
    }

    let avg_confidence: number | null = null;
    if (cardsPracticed > 0) {
      avg_confidence = totalConfidence / cardsPracticed;
      if (req.priority === "must" && avg_confidence >= 2) {
        readyMustCount++;
      }
    } else {
      if (req.priority === "must") {
        unpracticed_must_count++;
      }
    }

    weakReqs.push({
      requirement_id: req.id,
      text: req.text,
      priority: req.priority,
      kind: req.kind,
      avg_confidence,
      times_practiced: timesPracticed,
    });
  }

  // Sort logic:
  // a) must-priority first
  // b) lowest average confidence first
  // c) unpracticed must-priority ranked just below actively-low-confidence (effective score 2.5)
  weakReqs.sort((a, b) => {
    // Priority: 'must' over 'nice'
    if (a.priority !== b.priority) {
      return a.priority === "must" ? -1 : 1;
    }

    const scoreA = a.avg_confidence !== null ? a.avg_confidence : 2.5;
    const scoreB = b.avg_confidence !== null ? b.avg_confidence : 2.5;

    if (scoreA !== scoreB) {
      return scoreA - scoreB;
    }

    // Secondary sort: least practiced first
    return a.times_practiced - b.times_practiced;
  });

  const overall_readiness_pct =
    mustCount > 0 ? Math.round((readyMustCount / mustCount) * 100) : 0;

  return {
    weak_requirements: weakReqs,
    unpracticed_must_count,
    overall_readiness_pct,
  };
}
