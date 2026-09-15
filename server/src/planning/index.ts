import { checkCoverage } from "./coverage";
import type { KitDraft } from "../generation/index";
import type { Requirement, Question, LlmResult } from "../generation/llmClient";

type GenerateQuestionsFn = (
  requirement: Requirement,
  context: string
) => Promise<LlmResult<Question[]>>;

/**
 * Orchestrates the coverage checking loop.
 * Runs checkCoverage, and if gaps exist, calls the generator to fill them up to maxPasses.
 * 
 * Note: maxPasses defaults to 3. Since LLMs are slow and expensive, 
 * we cap retries to avoid infinite loops and massive bills if the LLM refuses 
 * to generate a question for a particularly weird/unusable requirement.
 */
export async function runCoveragePassLoop(
  kitDraft: KitDraft,
  hiringProcessContext: string,
  generateQuestionsForRequirement: GenerateQuestionsFn,
  maxPasses = 3
): Promise<KitDraft> {
  let coverage = checkCoverage(kitDraft.requirements, kitDraft.questions);
  
  while (coverage.uncovered_requirement_ids.length > 0 && coverage.passes < maxPasses) {
    coverage.passes++;
    console.log(`[Planning] Pass ${coverage.passes}/${maxPasses}: ${coverage.uncovered_requirement_ids.length} requirements missing coverage.`);
    
    const newQuestionsPromises = coverage.uncovered_requirement_ids.map(async (reqId) => {
      const req = kitDraft.requirements.find(r => r.id === reqId);
      if (!req) return [];
      
      const res = await generateQuestionsForRequirement(req, hiringProcessContext);
      if (res.ok) {
        return res.data;
      }
      return [];
    });
    
    const results = await Promise.all(newQuestionsPromises);
    const flattenedNewQuestions = results.flat();
    
    if (flattenedNewQuestions.length > 0) {
      kitDraft.questions.push(...flattenedNewQuestions);
    }
    
    // Re-check coverage with updated questions list, keeping the current passes count
    const nextCoverage = checkCoverage(kitDraft.requirements, kitDraft.questions);
    coverage.uncovered_requirement_ids = nextCoverage.uncovered_requirement_ids;
  }
  
  if (coverage.uncovered_requirement_ids.length === 0) {
    console.log(`[Planning] Perfect coverage achieved in ${coverage.passes} passes.`);
  } else {
    console.warn(`[Planning] Max passes (${maxPasses}) hit. ${coverage.uncovered_requirement_ids.length} gaps remain.`);
  }
  
  // Attach final coverage status honestly
  (kitDraft as any).coverage = coverage;
  
  return kitDraft;
}
