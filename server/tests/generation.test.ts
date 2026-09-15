import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { callLlm } from "../src/generation/llmClient";
import { extractRequirements } from "../src/generation/steps";

const { mockGenerateContent } = vi.hoisted(() => {
  return { mockGenerateContent: vi.fn() };
});

// Mock the Groq client entirely
vi.mock("groq-sdk", () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: mockGenerateContent
          }
        }
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
        choices: [{ message: { content: "```json\n{ bad json \n```" } }]
      });
      // 2nd attempt: good JSON
      mockGenerateContent.mockResolvedValueOnce({
        choices: [{ message: { content: '{"foo": "bar"}' } }]
      });

      const res = await callLlm("test prompt", DummySchema);

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      
      // Ensure the second prompt included the correction phrase
      // In Groq, the prompt is passed inside messages array: [{ role: "user", content: "..." }]
      const secondCallArgs = mockGenerateContent.mock.calls[1][0];
      const secondCallPrompt = secondCallArgs.messages[0].content;
      expect(secondCallPrompt).toContain("IMPORTANT CORRECTION:");

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.foo).toBe("bar");
      }
    });

    it("should return MALFORMED_JSON if it fails both attempts", async () => {
      // 1st attempt: bad JSON
      mockGenerateContent.mockResolvedValueOnce({
        choices: [{ message: { content: "{ bad" } }]
      });
      // 2nd attempt: bad JSON
      mockGenerateContent.mockResolvedValueOnce({
        choices: [{ message: { content: "{ still bad" } }]
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
        choices: [{ message: { content: '{"foo": "success"}' } }]
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
        choices: [{ message: { content: '[{"id": "r1", "text": "Basic JS", "kind": "technical", "priority": "must"}]' } }]
      });

      const res = await extractRequirements("Just looking for someone who knows basic JS.");

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      
      const promptPassed = mockGenerateContent.mock.calls[0][0].messages[0].content;
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
