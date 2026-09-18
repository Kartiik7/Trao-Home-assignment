import { describe, it, expect, vi } from "vitest";
import { checkCoverage } from "../src/planning/coverage";
import { allocateSchedule } from "../src/planning/scheduler";
import { runCoveragePassLoop } from "../src/planning/index";
import type { Requirement, Question } from "@ai-interview-prep/types";

describe("Planning Layer", () => {
  
  describe("checkCoverage", () => {
    const reqs: Requirement[] = [
      { id: "r1", text: "Req 1", kind: "technical", priority: "must" },
      { id: "r2", text: "Req 2", kind: "technical", priority: "nice" },
    ];

    it("should correctly identify zero gaps when fully covered", () => {
      const qs: Question[] = [
        { id: "q1", requirement_ids: ["r1", "r2"], category: "technical", prompt: "?", answer_outline: "!", difficulty: 2 }
      ];
      const res = checkCoverage(reqs, qs);
      expect(res.uncovered_requirement_ids).toHaveLength(0);
      expect(res.passes).toBe(0);
    });

    it("should identify uncovered requirements", () => {
      const qs: Question[] = [
        { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "?", answer_outline: "!", difficulty: 2 }
      ];
      const res = checkCoverage(reqs, qs);
      expect(res.uncovered_requirement_ids).toEqual(["r2"]);
    });

    it("should handle empty arrays without crashing", () => {
      const res = checkCoverage([], []);
      expect(res.uncovered_requirement_ids).toHaveLength(0);
    });
  });

  describe("allocateSchedule", () => {
    const reqs: Requirement[] = [
      { id: "r1", text: "Req 1", kind: "technical", priority: "must" },
      { id: "r2", text: "Req 2", kind: "behavioural", priority: "nice" }
    ];
    
    // q1 covers must, q2 covers nice
    const qs: Question[] = [
      { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "?", answer_outline: "!", difficulty: 1 },
      { id: "q2", requirement_ids: ["r2"], category: "behavioural", prompt: "?", answer_outline: "!", difficulty: 3 }
    ];

    it("should output exactly daysAvailable days (1 day case)", () => {
      const sched = allocateSchedule(reqs, qs, 1);
      expect(sched.days).toHaveLength(1);
      expect(sched.days[0].question_ids).toEqual(expect.arrayContaining(["q1", "q2"]));
      // minutes should be integers: diff 1 (15m) + diff 3 (40m) = 55m
      expect(sched.days[0].minutes).toBe(55);
    });

    it("should output exactly daysAvailable days (60 day case with few questions)", () => {
      const sched = allocateSchedule(reqs, qs, 60);
      expect(sched.days).toHaveLength(60);
      
      // Since it's N < D, the first 2 days get 1 question each, the rest get 0.
      expect(sched.days[0].question_ids).toHaveLength(1);
      expect(sched.days[1].question_ids).toHaveLength(1);
      expect(sched.days[2].question_ids).toHaveLength(0);
    });

    it("every MUST requirement appears somewhere in the schedule", () => {
      // The allocator throws if invariant fails. It shouldn't throw here.
      expect(() => allocateSchedule(reqs, qs, 2)).not.toThrow();
      
      // If we remove the must question, it should throw the invariant assertion
      const badQs = qs.filter(q => q.id !== "q1");
      expect(() => allocateSchedule(reqs, badQs, 2)).toThrow(/Invariant Violation/);
    });

    it("should front-load harder/must questions", () => {
      // q1 (Must, Diff 1)
      // q2 (Nice, Diff 3)
      // Since Priority (Must) > Difficulty, q1 should be sorted BEFORE q2, 
      // thus landing on day 1 if we have 2 days.
      const sched = allocateSchedule(reqs, qs, 2);
      expect(sched.days[0].question_ids).toEqual(["q1"]);
      expect(sched.days[1].question_ids).toEqual(["q2"]);
    });
  });

  describe("runCoveragePassLoop", () => {
    it("should stop at maxPasses even if gaps remain", async () => {
      const kitDraft: any = {
        requirements: [{ id: "r1", text: "Req 1", kind: "technical", priority: "must" }],
        questions: []
      };

      // Mock always fails to generate
      const mockGenerate = vi.fn().mockResolvedValue({ ok: true, data: [] });

      const res = await runCoveragePassLoop(kitDraft, "context", mockGenerate, 2);

      // It should have tried exactly 2 passes (since maxPasses = 2)
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(res.coverage.uncovered_requirement_ids).toEqual(["r1"]);
      expect(res.coverage.passes).toBe(2);
    });

    it("should stop early if coverage becomes clean", async () => {
      const kitDraft: any = {
        requirements: [{ id: "r1", text: "Req 1", kind: "technical", priority: "must" }],
        questions: []
      };

      const newQ: Question = { id: "q1", requirement_ids: ["r1"], category: "technical", prompt: "?", answer_outline: "!", difficulty: 1 };
      
      // Mock generates it on the first try
      const mockGenerate = vi.fn().mockResolvedValue({ ok: true, data: [newQ] });

      const res = await runCoveragePassLoop(kitDraft, "context", mockGenerate, 3);

      expect(mockGenerate).toHaveBeenCalledTimes(1); // Only needed 1 pass
      expect(res.coverage.uncovered_requirement_ids).toHaveLength(0);
      expect(res.coverage.passes).toBe(1);
    });

    it("should capture LLM failures in coverageFailures", async () => {
      const kitDraft: any = {
        requirements: [{ id: "r1", text: "Req 1", kind: "technical", priority: "must" }],
        questions: []
      };

      const mockGenerate = vi.fn().mockResolvedValue({
        ok: false,
        reason: "LLM_NETWORK_ERROR",
        details: "401 invalid_api_key"
      });

      const res: any = await runCoveragePassLoop(kitDraft, "context", mockGenerate, 1);

      expect(res.coverageFailures).toHaveLength(1);
      expect(res.coverageFailures[0]).toEqual({
        reason: "LLM_NETWORK_ERROR",
        details: "401 invalid_api_key"
      });
    });
  });
});
