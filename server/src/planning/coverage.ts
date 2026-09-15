import type { Requirement, Question, Coverage } from "@ai-interview-prep/types";

/**
 * Pure, deterministic function to check if all requirements are covered by at least one question.
 * Returns the IDs of requirements that have zero covering questions.
 */
export function checkCoverage(requirements: Requirement[], questions: Question[]): Coverage {
  const coveredIds = new Set<string>();

  for (const q of questions) {
    for (const reqId of q.requirement_ids) {
      coveredIds.add(reqId);
    }
  }

  const uncovered_requirement_ids = requirements
    .filter(req => !coveredIds.has(req.id))
    .map(req => req.id);

  return {
    uncovered_requirement_ids,
    passes: 0, // Starts at 0, incremented by the orchestrator loop
  };
}
