import type { Requirement, Question, Schedule, ScheduleDay } from "@ai-interview-prep/types";

function getDifficultyMinutes(diff: number): number {
  if (diff >= 3) return 40;
  if (diff === 2) return 25;
  return 15;
}

function determineFocus(questions: Question[]): string {
  if (questions.length === 0) return "Rest Day";

  const counts: Record<string, number> = {};
  for (const q of questions) {
    counts[q.category] = (counts[q.category] || 0) + 1;
  }

  let topCategory = "Mixed";
  let max = 0;
  for (const [cat, count] of Object.entries(counts)) {
    if (count > max) {
      max = count;
      topCategory = cat;
    }
  }

  // Format to Title Case e.g., "system-design" -> "System Design Focus"
  const formatted = topCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return `${formatted} Focus`;
}

/**
 * Pure, deterministic function to distribute questions across a fixed number of days.
 * - Front-loads harder/higher-priority questions.
 * - Asserts that every must-priority requirement is scheduled.
 */
export function allocateSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number
): Schedule {
  if (daysAvailable <= 0) throw new Error("daysAvailable must be > 0");

  // 1. Sort Questions
  // Priority: Does this question cover a MUST requirement?
  const mustReqIds = new Set(requirements.filter(r => r.priority === "must").map(r => r.id));
  
  const sortedQuestions = [...questions].sort((a, b) => {
    const aIsMust = a.requirement_ids.some(id => mustReqIds.has(id)) ? 1 : 0;
    const bIsMust = b.requirement_ids.some(id => mustReqIds.has(id)) ? 1 : 0;
    
    // Sort by Priority first (must > nice)
    if (aIsMust !== bIsMust) return bIsMust - aIsMust;
    
    // Sort by Difficulty descending (3 > 2 > 1)
    return b.difficulty - a.difficulty;
  });

  // 2. Chunking strategy
  const days: ScheduleDay[] = [];
  const N = sortedQuestions.length;
  
  if (N < daysAvailable) {
    // Edge Case: More days than questions. Fill first N days with 1 question, rest empty.
    for (let i = 0; i < daysAvailable; i++) {
      const qChunk = i < N ? [sortedQuestions[i]] : [];
      days.push({
        day: i + 1,
        focus: determineFocus(qChunk),
        question_ids: qChunk.map(q => q.id),
        minutes: qChunk.reduce((acc, q) => acc + getDifficultyMinutes(q.difficulty), 0)
      });
    }
  } else {
    // Normal chunking
    const baseChunk = Math.floor(N / daysAvailable);
    const remainder = N % daysAvailable;

    let qIdx = 0;
    for (let i = 0; i < daysAvailable; i++) {
      const chunkSize = baseChunk + (i < remainder ? 1 : 0);
      const qChunk = sortedQuestions.slice(qIdx, qIdx + chunkSize);
      qIdx += chunkSize;

      days.push({
        day: i + 1,
        focus: determineFocus(qChunk),
        question_ids: qChunk.map(q => q.id),
        minutes: qChunk.reduce((acc, q) => acc + getDifficultyMinutes(q.difficulty), 0)
      });
    }
  }

  // 3. Invariant Assertion
  const scheduledQuestionIds = new Set(days.flatMap(d => d.question_ids));
  const scheduledReqIds = new Set<string>();
  for (const q of questions) {
    if (scheduledQuestionIds.has(q.id)) {
      for (const rId of q.requirement_ids) {
        scheduledReqIds.add(rId);
      }
    }
  }

  for (const mustId of mustReqIds) {
    if (!scheduledReqIds.has(mustId)) {
      throw new Error(`Invariant Violation: MUST-priority requirement ${mustId} is not covered in the generated schedule.`);
    }
  }

  return {
    days_available: daysAvailable,
    days
  };
}
