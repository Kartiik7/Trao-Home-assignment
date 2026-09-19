// DEV ONLY — manual end-to-end smoke test for the retrieval + generation pipeline.
// Not part of the graded pipeline; run with: ts-node scripts/test-pipeline.ts
import "../src/env";
import path from "path";

import { researchCompany } from "../src/retrieval";
import { generateKitDraft } from "../src/generation";
import fs from "fs";

const SAMPLE_URL = "https://www.anthropic.com";
const SAMPLE_COMPANY = "Anthropic";
const SAMPLE_JD = `
We are looking for a Senior Frontend Engineer to join our team.
Requirements:
- 5+ years of experience with React and TypeScript.
- Deep understanding of web performance optimization.
- Ability to mentor junior engineers.
- Nice to have: experience with WebGL or Canvas.
`;

async function runManualTest() {
  console.log("==========================================");
  console.log(`🔍 1. Starting Retrieval Phase for ${SAMPLE_COMPANY}...`);
  console.log("==========================================\n");
  
  const research = await researchCompany(SAMPLE_URL, SAMPLE_COMPANY);
  
  console.log("✅ Retrieval Complete.");
  console.log(`- Pages crawled: ${research.pages.length}`);
  console.log(`- Discussion snippets found: ${research.discussion.length}`);
  console.log(`- Failures encountered: ${research.failures.length}\n`);

  console.log("==========================================");
  console.log("🧠 2. Starting LLM Generation Phase...");
  console.log("==========================================\n");

  const { draft, log } = await generateKitDraft(SAMPLE_JD, research);

  console.log("✅ Generation Complete.");
  console.log("- Generation Log:");
  console.log(JSON.stringify(log, null, 2));

  if (draft) {
    console.log(`\n- Requirements Extracted: ${draft.requirements.length}`);
    console.log(`- Questions Generated: ${draft.questions.length}`);
    console.log(`- Flashcards Generated: ${draft.flashcards.length}`);
    
    // Save to a file so it's easy to read
    const outputPath = path.resolve(__dirname, "..", "pipeline-output.json");
    fs.writeFileSync(outputPath, JSON.stringify(draft, null, 2));
    console.log(`\n🎉 Success! The full draft has been saved to: server/pipeline-output.json`);
  } else {
    console.log("\n❌ Generation failed to produce a draft.");
  }
}

runManualTest().catch(console.error);
