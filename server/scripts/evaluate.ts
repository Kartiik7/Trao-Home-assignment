/**
 * scripts/evaluate.ts
 *
 * Batch evaluation CLI.
 * Usage: npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * For now this is a stub that:
 *  1. Reads the input JSON array
 *  2. Validates each case has { id, jd, company_url, days }
 *  3. Writes a stub output file matching the Appendix B shape
 */

import * as fs from "fs";
import * as path from "path";
import {
  BatchInputSchema,
  type BatchInputCase,
  type BatchOutput,
  type BatchOutputKit,
  type Kit,
} from "@ai-interview-prep/types";

// ─── CLI Arg Parsing ───

function parseArgs(): { input: string; output: string } {
  const args = process.argv.slice(2);
  let input = "";
  let output = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--input" && args[i + 1]) {
      input = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      output = args[++i];
    }
  }

  if (!input || !output) {
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  return { input, output };
}

// ─── Stub Kit Factory ───

function createEmptyKit(): Kit {
  return {
    source: {
      company: "",
      company_url: "",
      role: "",
      location: "",
      jd_chars: 0,
      researched_at: new Date().toISOString(),
      pages_used: [],
    },
    company_brief: {
      summary: "",
      what_they_do: "",
      sources: [],
    },
    role: {
      title: "",
      seniority: "",
      responsibilities: [],
      requirements: [],
    },
    questions: [],
    flashcards: [],
    schedule: {
      days_available: 0,
      days: [],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 0,
    },
  };
}

// ─── Main ───

function main() {
  const { input, output } = parseArgs();

  // Read input file
  const inputPath = path.resolve(input);
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const rawInput = fs.readFileSync(inputPath, "utf-8");
  let cases: BatchInputCase[];

  try {
    const parsed = JSON.parse(rawInput);
    // Validate with Zod
    const result = BatchInputSchema.safeParse(parsed);
    if (!result.success) {
      console.error("❌ Input validation failed:");
      console.error(result.error.format());
      process.exit(1);
    }
    cases = result.data;
  } catch (err) {
    console.error("❌ Failed to parse input JSON:", err);
    process.exit(1);
  }

  console.log(`📥 Read ${cases.length} case(s) from ${inputPath}`);

  // Generate stub output
  const kits: BatchOutputKit[] = cases.map((c) => ({
    id: c.id,
    status: "ok" as const,
    kit: createEmptyKit(),
    error: null,
  }));

  const batchOutput: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };

  // Write output file
  const outputPath = path.resolve(output);
  fs.writeFileSync(outputPath, JSON.stringify(batchOutput, null, 2), "utf-8");
  console.log(`📤 Wrote ${kits.length} kit(s) to ${outputPath}`);
}

main();
