import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

// Initialize Gemini SDK
// If GEMINI_API_KEY is not in env, it will need to be mocked/stubbed for tests
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy-key-for-tests");
const MODEL_NAME = "gemini-1.5-flash"; // updated to correct model string

export type LlmResult<T> = 
  | { ok: true; data: T }
  | { ok: false; reason: string; details?: any };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a call to the LLM with exponential backoff for 429s.
 */
async function executeWithBackoff(prompt: string, attempt = 1): Promise<string> {
  const maxAttempts = 5;
  const baseDelayMs = 2000;

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(prompt);
    
    if (!result.response.text()) {
      throw new Error("Empty response from LLM");
    }
    
    return result.response.text();
  } catch (err: any) {
    const isRateLimit = err.status === 429 || err.message?.includes("429");
    
    if (isRateLimit && attempt < maxAttempts) {
      const backoff = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`[LLM] 429 Rate Limit hit. Retrying in ${backoff}ms (Attempt ${attempt}/${maxAttempts})`);
      await sleep(backoff);
      return executeWithBackoff(prompt, attempt + 1);
    }
    
    throw err;
  }
}

/**
 * Calls the LLM, expecting a JSON response that matches the provided Zod schema.
 * - Retries on 429s (rate limits) with exponential backoff.
 * - Retries ONCE on invalid JSON or failed schema validation by providing a correction prompt.
 * - Returns a typed LlmResult, never throwing exceptions on failure.
 */
export async function callLlm<T>(
  prompt: string,
  schema: z.ZodType<T>
): Promise<LlmResult<T>> {
  if (!process.env.GEMINI_API_KEY && process.env.NODE_ENV !== "test") {
    console.warn("⚠️ GEMINI_API_KEY not set. LLM calls will fail.");
  }

  let rawText = "";

  // Attempt 1
  try {
    rawText = await executeWithBackoff(prompt);
    
    // Parse and validate
    const parsedJson = JSON.parse(rawText);
    const validated = schema.safeParse(parsedJson);
    
    if (validated.success) {
      return { ok: true, data: validated.data };
    }
    
    // Schema validation failed, trigger Attempt 2 below
    throw new Error(`Schema validation failed: ${validated.error.message}`);
  } catch (err: any) {
    // If it was a network error (not a parse/validation error), fail immediately
    if (err.message && !err.message.includes("JSON") && !err.message.includes("Schema validation")) {
      return { ok: false, reason: "LLM_NETWORK_ERROR", details: err.message };
    }

    // Attempt 2: Correction prompt for malformed JSON or schema error
    console.warn("[LLM] Attempt 1 failed parsing/validation. Retrying with correction prompt...");
    
    const correctionPrompt = `${prompt}

---
IMPORTANT CORRECTION:
Your last response failed parsing or validation with this error: ${err.message}
Ensure you return ONLY valid JSON matching the requested structure. No markdown formatting like \`\`\`json outside the JSON object itself, just the raw JSON.`;

    try {
      rawText = await executeWithBackoff(correctionPrompt);
      
      // Clean up markdown block if the model included it despite instructions
      let cleanText = rawText.trim();
      if (cleanText.startsWith("```json")) {
        cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      }

      const parsedJson = JSON.parse(cleanText);
      const validated = schema.safeParse(parsedJson);
      
      if (validated.success) {
        return { ok: true, data: validated.data };
      }
      
      return { ok: false, reason: "SCHEMA_VALIDATION_FAILED", details: validated.error.message };
    } catch (retryErr: any) {
      return { ok: false, reason: "MALFORMED_JSON", details: retryErr.message };
    }
  }
}
