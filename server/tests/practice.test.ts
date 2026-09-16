import { describe, it, expect } from "vitest";
import { orderPracticeSession, type PracticeProgressRecord } from "../src/planning/practice";
import type { Flashcard } from "@ai-interview-prep/types";

const mockFlashcard = (id: string): Flashcard => ({
  id,
  front: `Front ${id}`,
  back: `Back ${id}`,
  requirement_ids: [],
});

describe("Phase 7: orderPracticeSession", () => {
  it("should return all cards in a sensible default order when there are no progress records", () => {
    const flashcards = [mockFlashcard("f1"), mockFlashcard("f2"), mockFlashcard("f3")];
    const records: PracticeProgressRecord[] = [];

    const result = orderPracticeSession(flashcards, records);
    expect(result.map(f => f.id)).toEqual(["f1", "f2", "f3"]); // Stable order
  });

  it("should prioritize lowest confidence (1), then never-seen, then 2, then 3", () => {
    const flashcards = [
      mockFlashcard("f_good"),   // Will rate 2
      mockFlashcard("f_easy"),   // Will rate 3
      mockFlashcard("f_again"),  // Will rate 1
      mockFlashcard("f_unseen"), // No record
    ];

    const records: PracticeProgressRecord[] = [
      { flashcard_id: "f_good", last_confidence: 2, times_seen: 1 },
      { flashcard_id: "f_easy", last_confidence: 3, times_seen: 2 },
      { flashcard_id: "f_again", last_confidence: 1, times_seen: 1 },
    ];

    const result = orderPracticeSession(flashcards, records);
    
    expect(result.map(f => f.id)).toEqual([
      "f_again",   // Weight 1
      "f_unseen",  // Weight 1.5
      "f_good",    // Weight 2
      "f_easy",    // Weight 3
    ]);
  });

  it("should treat cards with times_seen === 0 as never-seen even if a record exists", () => {
    const flashcards = [mockFlashcard("f1"), mockFlashcard("f2")];
    const records: PracticeProgressRecord[] = [
      { flashcard_id: "f1", last_confidence: 3, times_seen: 0 }, // Technically unseen
      { flashcard_id: "f2", last_confidence: 1, times_seen: 1 }, // Again
    ];

    const result = orderPracticeSession(flashcards, records);
    expect(result.map(f => f.id)).toEqual(["f2", "f1"]);
  });
});
