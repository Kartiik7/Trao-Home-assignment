/**
 * scripts/evaluate-timed.ts
 *
 * Timed batch evaluation with per-case timing and total wall-clock reporting.
 * Runs the same 5 real-world cases (including edge cases) and outputs:
 * - Per-case: status, time taken
 * - Summary: total time, average time, pass/fail counts
 *
 * Usage: npm run evaluate:timed
 */

import "../src/env";
import * as fs from "fs";
import * as path from "path";
import { BatchInputSchema, type BatchInputCase } from "@ai-interview-prep/types";
import { executePipelineCore } from "../src/services/pipeline.service";

const INPUT_FILE = path.resolve(__dirname, "..", "cases.json");
const OUTPUT_FILE = path.resolve(__dirname, "..", "timed-output.json");

function fmtMs(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(1);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

async function main() {
  console.log("⏱  Timed Batch Evaluation\n" + "=".repeat(50));

  const raw = fs.readFileSync(INPUT_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  const result = BatchInputSchema.safeParse(parsed);

  if (!result.success) {
    console.error("❌ Invalid cases.json:", result.error.format());
    process.exit(1);
  }

  const cases: BatchInputCase[] = result.data;
  console.log(`📥 Loaded ${cases.length} cases from ${INPUT_FILE}\n`);

  const results: any[] = [];
  const wallStart = Date.now();
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    const caseStart = Date.now();

    console.log(`\n[${i + 1}/${cases.length}] Case "${c.id}" — Starting...`);
    console.log(`    JD length : ${c.jd.length} chars`);
    console.log(`    URL       : ${c.company_url}`);

    const caseResult = await executePipelineCore(c.jd, c.company_url, c.days);
    const elapsed = Date.now() - caseStart;

    if (caseResult.ok) {
      passed++;
      console.log(`    ✅ PASSED in ${fmtMs(elapsed)}`);
      results.push({ id: c.id, status: "ok", elapsed_ms: elapsed, elapsed: fmtMs(elapsed) });
    } else {
      failed++;
      console.log(`    ❌ FAILED in ${fmtMs(elapsed)}: [${caseResult.error.code}] ${caseResult.error.message}`);
      results.push({
        id: c.id,
        status: "failed",
        error: `[${caseResult.error.code}] ${caseResult.error.message}`,
        elapsed_ms: elapsed,
        elapsed: fmtMs(elapsed),
      });
    }
  }

  const totalMs = Date.now() - wallStart;
  const avgMs = Math.round(totalMs / cases.length);

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary");
  console.log(`   Total Cases   : ${cases.length}`);
  console.log(`   Passed        : ${passed}`);
  console.log(`   Failed        : ${failed}`);
  console.log(`   Total Time    : ${fmtMs(totalMs)}`);
  console.log(`   Avg Per Case  : ${fmtMs(avgMs)}`);
  console.log("=".repeat(50));

  const report = {
    run_at: new Date().toISOString(),
    total_cases: cases.length,
    passed,
    failed,
    total_time: fmtMs(totalMs),
    total_ms: totalMs,
    avg_ms: avgMs,
    cases: results,
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📄 Full report saved to: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
