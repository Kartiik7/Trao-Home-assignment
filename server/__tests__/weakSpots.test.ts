import { describe, it, expect } from "vitest";
import { analyzeWeakSpots } from "../src/planning/weakSpots";
import type { Requirement, Flashcard } from "@ai-interview-prep/types";

describe("Weak Spots Logic", () => {
  const reqMust1: Requirement = { id: "r1", text: "React", kind: "technical", priority: "must" };
  const reqMust2: Requirement = { id: "r2", text: "Node", kind: "technical", priority: "must" };
  const reqNice: Requirement = { id: "r3", text: "AWS", kind: "domain", priority: "nice" };

  const reqs = [reqMust1, reqMust2, reqNice];

  const flashcards: Flashcard[] = [
    { id: "f1", requirement_ids: ["r1"], front: "", back: "" },
    { id: "f2", requirement_ids: ["r2"], front: "", back: "" },
    { id: "f3", requirement_ids: ["r3"], front: "", back: "" },
  ];

  it("flags a requirement with no practice data as unpracticed, not zero-confidence", () => {
    const report = analyzeWeakSpots(reqs, flashcards, []);
    
    const r1 = report.weak_requirements.find((r) => r.requirement_id === "r1");
    expect(r1?.avg_confidence).toBeNull();
    expect(r1?.times_practiced).toBe(0);
    
    expect(report.unpracticed_must_count).toBe(2); // r1 and r2
    expect(report.overall_readiness_pct).toBe(0);
  });

  it("ranking correctly prioritizes must+low-confidence over nice+low-confidence", () => {
    const records = [
      { flashcard_id: "f1", last_confidence: 1 as const, times_seen: 1 }, // r1 (must) avg 1
      { flashcard_id: "f3", last_confidence: 1 as const, times_seen: 1 }, // r3 (nice) avg 1
    ];
    
    const report = analyzeWeakSpots(reqs, flashcards, records);
    
    // The must requirement (r1) should come before the nice requirement (r3), even with same low confidence
    expect(report.weak_requirements[0].requirement_id).toBe("r1");
  });

  it("ranks unpracticed must-priority just below actively-low-confidence (effective score 2.5)", () => {
    const records = [
      { flashcard_id: "f1", last_confidence: 1 as const, times_seen: 1 }, // r1 (must) avg 1 (actively low)
      { flashcard_id: "f3", last_confidence: 3 as const, times_seen: 1 }, // r3 (nice) avg 3 (high)
      // r2 (must) has no records, so it's unpracticed. It should be ranked between avg 1 and avg 3.
    ];
    
    const report = analyzeWeakSpots(reqs, flashcards, records);
    
    // 1st: r1 (must, 1.0)
    // 2nd: r2 (must, unpracticed ~ 2.5)
    // 3rd: r3 (nice, 3.0)
    expect(report.weak_requirements[0].requirement_id).toBe("r1");
    expect(report.weak_requirements[1].requirement_id).toBe("r2");
    expect(report.weak_requirements[2].requirement_id).toBe("r3");
  });

  it("returns a near-100% readiness score for a fully-practiced, high-confidence kit", () => {
    const records = [
      { flashcard_id: "f1", last_confidence: 3 as const, times_seen: 1 }, // r1 (must) avg 3
      { flashcard_id: "f2", last_confidence: 2 as const, times_seen: 1 }, // r2 (must) avg 2
    ];
    
    const report = analyzeWeakSpots(reqs, flashcards, records);
    expect(report.overall_readiness_pct).toBe(100);
    expect(report.unpracticed_must_count).toBe(0);
  });
});
