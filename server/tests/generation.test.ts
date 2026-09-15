import { describe, it, expect, vi, beforeEach } from "vitest";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { callLlm } from "../src/generation/llmClient";
import { extractRequirements } from "../src/generation/steps";

const { mockGenerateContent } = vi.hoisted(() => {
  return { mockGenerateContent: vi.fn() };
});

// Mock the GoogleGenerativeAI client entirely
vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => {
      return {
        getGenerativeModel: vi.fn().mockReturnValue({
          generateContent: mockGenerateContent
        })
      };
    })
  };
});

const DummySchema = z.object({
  foo: z.string()
});

describe("LLM Generation Layer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent.mockClear();
  });

  describe("llmClient Resilience", () => {
    it("should retry once with correction on malformed JSON", async () => {
      // 1st attempt: bad JSON
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => "```json\n{ bad json \n```" }
      });
      // 2nd attempt: good JSON
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => '{"foo": "bar"}' }
      });

      const res = await callLlm("test prompt", DummySchema);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      
      // Ensure the second prompt included the correction phrase
      const secondCallPrompt = mockGenerateContent.mock.calls[1][0];
      expect(secondCallPrompt).toContain("IMPORTANT CORRECTION:");

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.foo).toBe("bar");
      }
    });

    it("should return MALFORMED_JSON if it fails both attempts", async () => {
      // 1st attempt: bad JSON
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => "{ bad" }
      });
      // 2nd attempt: bad JSON
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => "{ still bad" }
      });

      const res = await callLlm("test prompt", DummySchema);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.reason).toBe("MALFORMED_JSON");
      }
    });

    it("should retry with exponential backoff on 429", async () => {
      // Temporarily mock console.warn to avoid noisy test output
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // 1st attempt: Rate Limit error
      const rateLimitErr = new Error("Too Many Requests");
      (rateLimitErr as any).status = 429;
      mockGenerateContent.mockRejectedValueOnce(rateLimitErr);
      
      // 2nd attempt: Success
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => '{"foo": "success"}' }
      });

      const res = await callLlm("test prompt", DummySchema);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.foo).toBe("success");
      }

      warnSpy.mockRestore();
    });
  });

  describe("Pipeline Steps", () => {
    it("extractRequirements should not invent requirements for a thin JD", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        response: { text: () => '[{"id": "r1", "text": "Basic JS", "kind": "technical", "priority": "must"}]' }
      });

      const res = await extractRequirements("Just looking for someone who knows basic JS.");

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      
      const promptPassed = mockGenerateContent.mock.calls[0][0];
      expect(promptPassed).toContain("DO NOT invent or infer requirements");
      expect(promptPassed).toContain("Just looking for someone who knows basic JS.");

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0].id).toBe("r1");
      }
    });
  });
});
