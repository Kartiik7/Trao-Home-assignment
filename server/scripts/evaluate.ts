/**
 * scripts/evaluate.ts
 *
 * Batch evaluation CLI.
 * Usage: npm run evaluate -- --input <cases.json> --output <kits.json>
 *
 * Refactored in Phase 5 to use the real deterministic pipeline core logic.
 */

import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import {
  BatchInputSchema,
  type BatchInputCase,
  type BatchOutput,
  type BatchOutputKit,
  type Kit,
} from "@ai-interview-prep/types";

import { executePipelineCore } from "../src/services/pipeline.service";

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

// ─── Main ───

async function main() {
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

  const kits: BatchOutputKit[] = [];

  // Process each case sequentially
  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    console.log(`\n⏳ Processing case ${i + 1}/${cases.length} (ID: ${c.id})...`);
    
    // We execute the isolated core logic directly, not via HTTP or MongoDB
    const result = await executePipelineCore(c.jd, c.company_url, c.days);

    if (result.ok) {
      console.log(`✅ Case ${c.id} generated successfully.`);
      kits.push({
        id: c.id,
        status: "ok",
        kit: result.kit,
        error: null,
      });
    } else {
      console.error(`❌ Case ${c.id} failed:`, result.error);
      kits.push({
        id: c.id,
        status: "failed",
        kit: null,
        error: result.error,
      });
    }
  }

  const batchOutput: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };

  // Write output file
  const outputPath = path.resolve(output);
  fs.writeFileSync(outputPath, JSON.stringify(batchOutput, null, 2), "utf-8");
  console.log(`\n📤 Wrote ${kits.length} kit(s) to ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error in batch script:", err);
  process.exit(1);
});
