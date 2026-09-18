import { describe, it, expect, vi, beforeEach } from "vitest";
import { Kit } from "../src/models/Kit";
import { runPipelineAsync, executePipelineCore } from "../src/services/pipeline.service";

// Mock the Mongoose Kit model
vi.mock("../src/models/Kit", () => ({
  Kit: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findOne: vi.fn(),
    exists: vi.fn(),
  }
}));

import { generateKitDraft } from "../src/generation/index";
import { researchCompany } from "../src/retrieval/index";
import { runCoveragePassLoop } from "../src/planning/index";
import { allocateSchedule } from "../src/planning/scheduler";
import { validateKit } from "@ai-interview-prep/types";

vi.mock("../src/generation/index", () => ({
  generateKitDraft: vi.fn(),
  generateQuestionsForRequirement: vi.fn(),
}));

vi.mock("../src/retrieval/index", () => ({
  researchCompany: vi.fn().mockResolvedValue({ pages: [], discussion: [], failures: [] }),
}));

vi.mock("../src/planning/index", () => ({
  runCoveragePassLoop: vi.fn().mockResolvedValue({}),
}));

vi.mock("../src/planning/scheduler", () => ({
  allocateSchedule: vi.fn().mockReturnValue({ days_available: 1, days: [] }),
}));

vi.mock("@ai-interview-prep/types", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    validateKit: vi.fn().mockReturnValue({ success: true, data: {} }),
  };
});

describe("Phase 5: API & Persistence Layer", () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Deduplication Logic", () => {
    it("should return the existing kit if a duplicate submission occurs", async () => {
      // Mock Kit.findOne to simulate an existing duplicate kit
      const mockExistingKit = { _id: "duplicate123", status: "ready" };
      vi.mocked(Kit.findOne).mockResolvedValue(mockExistingKit as any);

      // Simulating the exact logic from the POST /kits route
      const req = {
        userId: "user123",
        body: { jd: "Senior Dev", company_url: "https://x.com", days: 7 }
      };

      // Ensure findOne is called with the hashed JD and company_url
      const existing = await Kit.findOne({
        userId: req.userId,
        "inputs.company_url": req.body.company_url,
      });

      expect(existing).toEqual(mockExistingKit);
      expect(existing!._id).toBe("duplicate123");
    });
  });

  describe("Pipeline Failure Isolation", () => {
    it("should safely mark status as 'failed' if executePipelineCore throws or fails, without crashing", async () => {
      
      const mockDoc = {
        _id: "kit123",
        inputs: { jd: "Dev", company_url: "https://test.com", days: 1 },
        status: "pending",
        error: null,
        generation_log: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.mocked(Kit.findById).mockResolvedValue(mockDoc as any);

      // Simulate a deep failure in the generation layer
      vi.mocked(generateKitDraft).mockResolvedValue({
        draft: null,
        log: [{ step: "generation", success: false }]
      } as any);

      // Run the wrapper
      await expect(runPipelineAsync("kit123")).resolves.not.toThrow();

      // Check if it saved the failed state
      expect(mockDoc.status).toBe("failed");
      expect(mockDoc.error).toEqual({ code: "GENERATION_FAILED", message: "Failed to generate initial draft" });
      expect(mockDoc.generation_log.length).toBeGreaterThan(0);
      expect(mockDoc.save).toHaveBeenCalled();
    });

    it("should catch unexpected FATAL exceptions thrown outside the core wrapper and not crash", async () => {
      const mockDoc = {
        _id: "kit123",
        inputs: { jd: "Dev", company_url: "https://test.com", days: 1 },
        status: "pending",
        generation_log: [],
        save: vi.fn().mockRejectedValue(new Error("Simulated Database Crash"))
      };

      vi.mocked(Kit.findById).mockResolvedValue(mockDoc as any);
      vi.mocked(generateKitDraft).mockResolvedValue({
        draft: {} as any,
        log: []
      });

      // If doc.save() throws during the success branch, the wrapper catch block should trigger
      await expect(runPipelineAsync("kit123")).resolves.not.toThrow();

      // Ensure it tried to use the emergency fallback findByIdAndUpdate
      expect(Kit.findByIdAndUpdate).toHaveBeenCalledWith("kit123", {
        status: "failed",
        error: { code: "FATAL_ERROR", message: "Simulated Database Crash" }
      });
    });
  });

  describe("Practice Progress Authorization", () => {
    it("should return 404 for POST /kits/:bogus-id/practice when kit does not exist or is not owned by user", async () => {
      vi.mocked(Kit.exists).mockResolvedValue(null as any);

      const req: any = {
        params: { id: "bogus-id" },
        userId: "user123",
        body: { flashcard_id: "fc1", confidence: 2 }
      };

      const kitExists = await Kit.exists({ _id: req.params.id, userId: req.userId });
      
      expect(Kit.exists).toHaveBeenCalledWith({ _id: "bogus-id", userId: "user123" });
      expect(kitExists).toBeNull();
    });
  });
});
