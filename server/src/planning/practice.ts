import type { Flashcard } from "@ai-interview-prep/types";

export interface PracticeProgressRecord {
  flashcard_id: string;
  last_confidence: 1 | 2 | 3;
  times_seen: number;
}

/**
 * Orders a practice session based on a confidence-weighted sort.
 * Prioritizes:
 * 1. Lowest confidence (1)
 * 2. Never seen (No record, treated as implicitly < 2 but > 1)
 * 3. Medium confidence (2)
 * 4. Highest confidence (3)
 * 
 * In case of ties, falls back to stable original sorting.
 */
export function orderPracticeSession(
  flashcards: Flashcard[],
  progressRecords: PracticeProgressRecord[]
): Flashcard[] {
  // Create a fast lookup map
  const progressMap = new Map<string, PracticeProgressRecord>();
  for (const record of progressRecords) {
    progressMap.set(record.flashcard_id, record);
  }

  // Weight map: lower weight = comes first
  // 1 (Again) -> weight 1
  // Never seen -> weight 1.5
  // 2 (Good) -> weight 2
  // 3 (Easy) -> weight 3
  const getWeight = (fId: string): number => {
    const record = progressMap.get(fId);
    if (!record || record.times_seen === 0) return 1.5;
    return record.last_confidence;
  };

  // Clone to avoid mutating original array
  const sorted = [...flashcards];

  sorted.sort((a, b) => {
    const weightA = getWeight(a.id);
    const weightB = getWeight(b.id);
    
    // Sort ascending by weight
    if (weightA !== weightB) {
      return weightA - weightB;
    }
    
    // Fallback: keep original stable order if weights tie
    return 0;
  });

  return sorted;
}
