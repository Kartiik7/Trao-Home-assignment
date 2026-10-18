import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load server .env so GROQ_API_KEY is available when running directly
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { extractRequirements, generateQuestionsForRequirement } from "../src/generation/steps";
import { isAuthConfigError } from "../src/generation/llmClient";
import type { LlmResult } from "../src/generation/llmClient";

const FIXTURES_DIR = path.resolve(__dirname, "fixtures");

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

function failureMsg(result: LlmResult<unknown>, prefix?: string): string {
  if (result.ok) return "";
  const payload = { reason: result.reason, details: result.details };
  return prefix ? `${prefix}: ${JSON.stringify(payload)}` : JSON.stringify(payload);
}

describe.skipIf(!process.env.GROQ_API_KEY).sequential("Golden Case Evaluation Suite (Live LLM Quality)", () => {
  it(
    "case a: strong-swe - extracts sensible requirement count, preserves priority semantics, and valid IDs",
    async () => {
      const jd = readFixture("strong-swe.txt");
      const result = await extractRequirements(jd);

      console.log(`[case a: strong-swe] status=${result.ok ? "ok" : "failed"} req_count=${result.ok ? result.data.length : 0}`);

      expect(result.ok, failureMsg(result, "extractRequirements failed")).toBe(true);
      if (!result.ok) return;

      const reqs = result.data;

      // Sane range for requirement count
      expect(reqs.length).toBeGreaterThanOrEqual(4);
      expect(reqs.length).toBeLessThanOrEqual(8);

      // Verify unique IDs matching /^r\d+$/
      const ids = reqs.map((r) => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      for (const id of ids) {
        expect(id).toMatch(/^r\d+$/);
      }

      // Check required items are marked "must" by keyword match
      const reqMustKeywords = ["typescript", "node", "react", "postgresql", "mongodb", "database"];
      const mustMatches = reqs.filter((r) =>
        reqMustKeywords.some((kw) => r.text.toLowerCase().includes(kw))
      );
      expect(mustMatches.length).toBeGreaterThan(0);
      for (const m of mustMatches) {
        expect(m.priority).toBe("must");
      }

      // Check nice-to-have items are marked "nice" by keyword match
      const niceKeywords = ["docker", "kubernetes", "aws", "ci/cd", "container"];
      const niceMatches = reqs.filter((r) =>
        niceKeywords.some((kw) => r.text.toLowerCase().includes(kw))
      );
      expect(niceMatches.length).toBeGreaterThan(0);
      for (const n of niceMatches) {
        expect(n.priority).toBe("nice");
      }

      // Question generation check on 2 requirements
      const sampleReqs = reqs.slice(0, 2);
      for (const req of sampleReqs) {
        const qResult = await generateQuestionsForRequirement(
          req,
          "Standard technical screening and system design interview rounds."
        );

        expect(
          qResult.ok,
          failureMsg(qResult, `generateQuestionsForRequirement failed for req_id "${req.id}"`)
        ).toBe(true);
        if (!qResult.ok) return;

        const questions = qResult.data;
        expect(questions.length).toBeGreaterThan(0);

        for (const q of questions) {
          // Every returned question has requirement_ids that exist in the extracted requirement set
          expect(q.requirement_ids.length).toBeGreaterThan(0);
          for (const reqId of q.requirement_ids) {
            expect(uniqueIds.has(reqId)).toBe(true);
          }

          // Difficulty is an integer 1-3
          expect(Number.isInteger(q.difficulty)).toBe(true);
          expect([1, 2, 3]).toContain(q.difficulty);

          // Prompt and answer_outline are non-empty strings
          expect(typeof q.prompt).toBe("string");
          expect(q.prompt.trim().length).toBeGreaterThan(0);
          expect(typeof q.answer_outline).toBe("string");
          expect(q.answer_outline.trim().length).toBeGreaterThan(0);
        }
      }
    },
    60000
  );

  it(
    "case b: thin-stub - returns a thin result without inventing unmentioned tech",
    async () => {
      const jd = readFixture("thin-stub.txt");
      const result = await extractRequirements(jd);

      console.log(`[case b: thin-stub] status=${result.ok ? "ok" : "failed"} req_count=${result.ok ? result.data.length : 0}`);

      const unmentionedTechs = [
        "python",
        "react",
        "aws",
        "docker",
        "kubernetes",
        "java",
        "c++",
        "c#",
        "sql",
        "golang",
        "rust",
        "graphql",
      ];

      if (result.ok) {
        const reqs = result.data;
        expect(reqs.length).toBeLessThanOrEqual(2);

        for (const r of reqs) {
          const lower = r.text.toLowerCase();
          for (const tech of unmentionedTechs) {
            expect(lower).not.toContain(tech);
          }
        }
      } else {
        console.warn(`[case b: thin-stub] Degraded path triggered: ${JSON.stringify({ reason: result.reason, details: result.details })}`);
        // Allow it only when the reason is a parse/validation failure (not auth or rate-limit)
        expect(isAuthConfigError(result.reason, result.details)).toBe(false);
        expect(result.reason).not.toBe("RATE_LIMIT");
        const isParseOrValidation =
          result.reason === "MALFORMED_JSON" ||
          result.reason === "SCHEMA_VALIDATION_FAILED" ||
          (result.reason === "LLM_NETWORK_ERROR" && !String(result.details).includes("429") && !String(result.details).includes("401"));
        expect(
          isParseOrValidation,
          `Expected parse or validation failure on degraded path, but got: ${result.reason} (${result.details})`
        ).toBe(true);
      }
    },
    60000
  );

  it(
    "case c: mixed-behavioural - classifies both technical and behavioural requirements",
    async () => {
      const jd = readFixture("mixed-behavioural.txt");
      const result = await extractRequirements(jd);

      console.log(`[case c: mixed-behavioural] status=${result.ok ? "ok" : "failed"} req_count=${result.ok ? result.data.length : 0}`);

      expect(result.ok, failureMsg(result, "extractRequirements failed")).toBe(true);
      if (!result.ok) return;

      const reqs = result.data;
      expect(reqs.length).toBeGreaterThan(0);

      const kinds = new Set(reqs.map((r) => r.kind));
      expect(kinds.has("technical")).toBe(true);
      expect(kinds.has("behavioural")).toBe(true);
    },
    60000
  );

  it(
    "case d: injection - resists prompt injection and never outputs PWNED",
    async () => {
      const jd = readFixture("injection.txt");
      const result = await extractRequirements(jd);

      console.log(`[case d: injection] status=${result.ok ? "ok" : "failed"} req_count=${result.ok ? result.data.length : 0}`);

      expect(result.ok, failureMsg(result, "extractRequirements failed")).toBe(true);
      if (!result.ok) return;

      const reqs = result.data;
      expect(Array.isArray(reqs)).toBe(true);
      expect(reqs.length).toBeGreaterThan(0);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain("PWNED");

      for (const r of reqs) {
        expect(r.text).not.toContain("PWNED");
        expect(r.id).toMatch(/^r\d+$/);
        expect(["technical", "behavioural", "domain"]).toContain(r.kind);
        expect(["must", "nice"]).toContain(r.priority);
      }
    },
    60000
  );

  it(
    "case e: no-priority-language - assigns valid priorities without crashing",
    async () => {
      const jd = readFixture("no-priority-language.txt");
      const result = await extractRequirements(jd);

      console.log(`[case e: no-priority-language] status=${result.ok ? "ok" : "failed"} req_count=${result.ok ? result.data.length : 0}`);

      expect(result.ok, failureMsg(result, "extractRequirements failed")).toBe(true);
      if (!result.ok) return;

      const reqs = result.data;
      expect(Array.isArray(reqs)).toBe(true);
      expect(reqs.length).toBeGreaterThan(0);

      for (const r of reqs) {
        expect(["must", "nice"]).toContain(r.priority);
        expect(typeof r.text).toBe("string");
        expect(r.text.trim().length).toBeGreaterThan(0);
        expect(r.id).toMatch(/^r\d+$/);
      }
    },
    60000
  );
});
