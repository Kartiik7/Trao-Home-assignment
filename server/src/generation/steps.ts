import { z } from "zod";
import { callLlm, LlmResult } from "./llmClient";
import type { CrawledPage } from "../retrieval/crawler";
import type { DiscussionResult } from "../retrieval/search";

// ─── 1. Extract Requirements ───

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
});
export type Requirement = z.infer<typeof RequirementSchema>;

export async function extractRequirements(jdText: string): Promise<LlmResult<Requirement[]>> {
  const schema = z.array(RequirementSchema);
  const prompt = `
You are an expert technical recruiter. Extract the core requirements from the following Job Description.

CRITICAL INSTRUCTIONS:
1. ONLY extract requirements that are actually explicitly stated in the text.
2. DO NOT invent or infer requirements. If the JD is sparse, return a small list.
3. Classify "required/must have" language as "must", and "nice to have/bonus/preferred" as "nice".
4. Assign sequential ids starting with "r1" (e.g., "r1", "r2").
5. Return ONLY a JSON array of objects matching this schema:
[{ "id": string, "text": string, "kind": "technical" | "behavioural" | "domain", "priority": "must" | "nice" }]

Job Description:
${jdText.substring(0, 50000)}
`;
  return callLlm(prompt, schema);
}

// ─── 2. Generate Company Brief ───

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export async function generateCompanyBrief(pages: CrawledPage[]): Promise<LlmResult<CompanyBrief>> {
  const schema = CompanyBriefSchema;
  
  const content = pages.map(p => `URL: ${p.url}\nCategory: ${p.category}\nContent: ${p.text.substring(0, 10000)}`).join("\n\n---\n\n");
  
  const prompt = `
You are an expert technical researcher preparing an interviewee for an interview.
Based on the following scraped pages from the company's website, generate a company brief.

CRITICAL INSTRUCTIONS:
1. If the provided pages are empty, generic, or lack clear context about what the company does, output an honest brief stating that information is unavailable. Do NOT fabricate or hallucinate information.
2. Include a list of the URLs used as sources.
3. Return ONLY a JSON object matching this schema:
{ "summary": string, "what_they_do": string, "sources": string[] }

Scraped Content:
${content || "No pages provided."}
`;
  return callLlm(prompt, schema);
}

// ─── 3. Generate Questions ───

export const QuestionSchema = z.object({
  id: z.string(),
  requirement_ids: z.array(z.string()),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]),
  prompt: z.string(),
  answer_outline: z.string(),
  difficulty: z.number().min(1).max(3),
});
export type Question = z.infer<typeof QuestionSchema>;

export async function generateQuestionsForRequirement(
  requirement: Requirement,
  hiringProcessContext: string
): Promise<LlmResult<Question[]>> {
  const schema = z.array(QuestionSchema);
  
  const prompt = `
You are an expert technical interviewer. Generate 2 to 4 interview questions targeting the following specific requirement.

Requirement ID: ${requirement.id}
Requirement: ${requirement.text}
Kind: ${requirement.kind}
Priority: ${requirement.priority}

Hiring Process Context (incorporate this into the style of questions, if relevant):
${hiringProcessContext}

CRITICAL INSTRUCTIONS:
1. Tailor the category of the question to the requirement (e.g. "5+ years React" -> technical/system-design, "mentors juniors" -> behavioural).
2. "difficulty" must be 1, 2, or 3.
3. Assign unique IDs to each question like "q_" + a random string/number.
4. "requirement_ids" should contain ONLY ["${requirement.id}"].
5. Return ONLY a JSON array of objects matching this schema:
[{ "id": string, "requirement_ids": string[], "category": "technical" | "behavioural" | "system-design" | "company-fit", "prompt": string, "answer_outline": string, "difficulty": number }]
`;
  return callLlm(prompt, schema);
}

// ─── 4. Generate Flashcards ───

export const FlashcardSchema = z.object({
  id: z.string(),
  front: z.string(),
  back: z.string(),
  requirement_ids: z.array(z.string()),
});
export type Flashcard = z.infer<typeof FlashcardSchema>;

export async function generateFlashcards(
  requirements: Requirement[],
  questions: Question[]
): Promise<LlmResult<Flashcard[]>> {
  const schema = z.array(FlashcardSchema);
  
  const reqStr = JSON.stringify(requirements.map(r => ({ id: r.id, text: r.text })));
  const qStr = JSON.stringify(questions.map(q => ({ req_id: q.requirement_ids[0], prompt: q.prompt, answer: q.answer_outline })));
  
  const prompt = `
You are an expert study aid creator. Condense the following requirements and interview questions into concise flashcards for quick review.

Requirements:
${reqStr}

Questions:
${qStr}

CRITICAL INSTRUCTIONS:
1. Create 3 to 6 flashcards total. Do NOT do new research, just condense the provided info.
2. The front should be a short prompt or concept. The back should be the concise answer.
3. Assign unique IDs like "f_" + random string.
4. Map the flashcard to the relevant requirement IDs.
5. Return ONLY a JSON array of objects matching this schema:
[{ "id": string, "front": string, "back": string, "requirement_ids": string[] }]
`;
  return callLlm(prompt, schema);
}
