import { describe, it, expect } from "vitest";
import { mergeRegeneratedSection } from "../src/planning/merge";
import type { Kit, Question } from "@ai-interview-prep/types";

// Helper factory to make mock questions
const makeQ = (id: string, category: any, origin: any, pinned: boolean): Question => ({
  id,
  category,
  requirement_ids: [],
  prompt: `Prompt ${id}`,
  answer_outline: `Answer ${id}`,
  difficulty: 1,
  _meta: { origin, pinned }
});

describe("Phase 6: Merge Regenerated Section", () => {
  it("should replace unpinned company_brief and keep pinned company_brief", () => {
    const existingKit = {
      company_brief: { summary: "Old", what_they_do: "Old", sources: [], _meta: { pinned: false, origin: "generated" } }
    } as any;
    
    const newBrief = { summary: "New", what_they_do: "New", sources: [], _meta: { pinned: false, origin: "generated" } };

    // Unpinned gets replaced
    let merged = mergeRegeneratedSection(existingKit, { company_brief: newBrief }, { type: "company_brief" });
    expect(merged.company_brief.summary).toBe("New");

    // Pinned survives
    existingKit.company_brief._meta.pinned = true;
    merged = mergeRegeneratedSection(existingKit, { company_brief: newBrief }, { type: "company_brief" });
    expect(merged.company_brief.summary).toBe("Old");
  });

  it("should discard unpinned questions in scope, keep pinned ones, and append new ones", () => {
    const existingKit = {
      questions: [
        makeQ("q1", "technical", "generated", false), // Unpinned in scope -> DISCARD
        makeQ("q2", "technical", "edited", true),     // Pinned in scope -> KEEP
        makeQ("q3", "behavioural", "generated", false) // Unpinned OUT of scope -> KEEP
      ]
    } as any;

    const regeneratedItems = {
      questions: [
        makeQ("new1", "technical", "generated", false)
      ]
    } as any;

    const merged = mergeRegeneratedSection(existingKit, regeneratedItems, { type: "questions", category: "technical" });

    expect(merged.questions).toHaveLength(3);
    const ids = merged.questions.map(q => q.id);
    expect(ids).not.toContain("q1"); // Discarded
    expect(ids).toContain("q2"); // Kept (pinned)
    expect(ids).toContain("q3"); // Kept (out of scope)
    expect(ids).toContain("new1"); // Appended new
  });

  it("should replace all unpinned questions if no category scope is provided", () => {
    const existingKit = {
      questions: [
        makeQ("q1", "technical", "generated", false), // DISCARD
        makeQ("q2", "behavioural", "manual", true),   // KEEP
      ]
    } as any;

    const regeneratedItems = {
      questions: [
        makeQ("new1", "technical", "generated", false)
      ]
    } as any;

    const merged = mergeRegeneratedSection(existingKit, regeneratedItems, { type: "questions" });

    expect(merged.questions).toHaveLength(2);
    expect(merged.questions.map(q => q.id)).toEqual(["q2", "new1"]);
  });
});
