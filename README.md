# AI Interview Prep Kit

## 1. Project Overview and Tech Stack
This project is an AI-powered Interview Preparation Kit builder. It takes a Job Description and a company URL, scrapes the web for company context, and uses an LLM to dynamically generate study requirements, interview questions, flashcards, and a day-by-day study schedule.

**Tech Stack**:
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide React. Chosen for building a fast, modern, responsive UI with optimistic local state.
- **Backend**: Node.js, Express.js. Chosen for lightweight API routing and easy integration with AI SDKs.
- **Database**: MongoDB (Mongoose). Chosen for its flexible document schema, easily accommodating the deeply nested JSON output from the LLMs.
- **Validation**: Zod (for API payloads and enforcing strict LLM JSON schemas).

## 2. Setup Instructions

### Local Development
1. **Install Dependencies:**
   Run `npm install` at the project root to install workspaces.
   ```bash
   npm install
   ```
2. **Environment Variables:**
   Copy the example environment files and fill in your keys:
   - Client (`client/.env`): Check `client/.env.example` (requires `API_URL`, `NEXT_PUBLIC_API_URL`).
   - Server (`server/.env`): Check `server/.env.example` (requires `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`, `GROQ_API_KEY`, `GROQ_MODEL`, `TAVILY_API_KEY`).
3. **Run the Dev Servers:**
   Start the frontend and backend concurrently:
   ```bash
   # In client/
   npm run dev
   
   # In server/
   npm run dev
   ```

### Batch Entry Point (Evaluation Script)
To generate full kits from a JSON array of inputs (as defined in `cases.json`):
```bash
cd server
npm run evaluate -- --input cases.json --output output.json
```

## 3. LLM Provider and Model
- **Provider:** Groq (via `groq-sdk`)
- **Model:** `openai/gpt-oss-20b` (Configured via `GROQ_MODEL` environment variable). Chosen for extreme generation speed and reliable JSON-mode outputs.

## 4. High-Level Architecture
The project is structured as a monorepo with three primary packages:
- `client/`: Next.js frontend application.
- `server/`: Express backend API and worker processes.
- `shared/types/` (`@ai-interview-prep/types`): Shared Zod validation schemas and TypeScript interfaces ensuring end-to-end type safety.

The server's business logic (`server/src/`) strictly separates concerns into distinct layers:
- **Retrieval (`server/src/retrieval/`)**: Handles web crawling, URL validation, and Tavily API searches.
- **Generation (`server/src/generation/`)**: Orchestrates LLM prompting and schema validation using `groq-sdk`.
- **Planning (`server/src/planning/`)**: Houses deterministic logic for scheduling, coverage-gap detection, and merging regenerated items.
- **Persistence (`server/src/models/` & `server/src/routes/`)**: Mongoose models, deduplication logic, and Express API endpoints.

## 5. Retrieval Approach and Sources
The retrieval layer enriches the context before LLM generation:
- **Web Crawler (`server/src/retrieval/crawler.ts`)**: Instead of hardcoding paths (like `/about`), the crawler dynamically fetches the homepage, ranks internal links heuristically, and follows them to build a comprehensive context while strictly adhering to `robots.txt`.
- **Public Discussion Search (`server/src/retrieval/search.ts`)**: Uses the Tavily Search API to find public sentiment and technical discussions about the company.
- **Security Validation (`server/src/retrieval/validator.ts`)**: To prevent Server-Side Request Forgery (SSRF), the validator ensures that all requested URLs are public, safely formatted, and not pointing to internal/private IP ranges.

## 6. Research and Generation Sequence
The kit generation pipeline (`server/src/generation/index.ts`) is orchestrated in a strict sequence:
1. **Parallel Extraction**: `extractRequirements` (parsing the JD) and `generateCompanyBrief` (synthesizing crawler/search research) run concurrently.
2. **Per-Requirement Question Generation**: `generateQuestionsForRequirement` runs for each extracted requirement. This is wrapped in a `p-limit(2)` concurrency cap to avoid rate limits.
3. **Flashcards**: `generateFlashcards` builds behavioral/trivia items.
4. **Planning Layer Pass**: The draft is passed to `runCoveragePassLoop` and `allocateSchedule` (`server/src/planning/index.ts`). 

**Why Coverage & Scheduling are Pure Code:**
The coverage checker and schedule allocator do not use LLMs. This is an intentional design choice to guarantee deterministic outputs, enforce strict invariants (e.g., exactly `N` days, precise integer-minute durations), and drastically reduce API costs and latency.

## 7. Generated, Edited, and Pinned State
All kit items (questions, flashcards, briefs) share a metadata model:
```ts
_meta: { origin: "generated" | "edited" | "manual", pinned: boolean }
```
- **Tracking Edits**: When a user modifies an item via `PATCH /kits/:id` (`server/src/routes/kits.routes.ts`), the `pinEditedItems` helper deep-compares the text and auto-flips `origin` to `"edited"` and `pinned` to `true`.
- **Regeneration Integrity**: During a partial regeneration, `mergeRegeneratedSection` (`server/src/planning/merge.ts`) drops unpinned items but perfectly preserves `pinned` items, ensuring user edits survive AI reruns.

## 8. Schedule Allocation
Schedule allocation (`server/src/planning/scheduler.ts`) distributes questions across the requested days:
- **Sorting**: Questions are sorted by priority (e.g., "must" vs "nice-to-have") and difficulty. This ensures that the hardest, most critical questions are front-loaded early in the schedule.
- **Weighting**: Each question type maps to an integer minute duration (e.g., Difficulty 1 = 15m, Difficulty 3 = 40m). The allocator guarantees the output fits exactly `N` days.

## 9. Practice Mode Ordering
Practice mode uses a confidence-weighted sort (`orderPracticeSession` in `server/src/planning/practice.ts`). 
Weights are calculated based on the user's `last_confidence` rating:
1. **Lowest confidence** (`1`) -> Weight 1.0 (Shown First)
2. **Never seen** (No record) -> Weight 1.5
3. **Medium confidence** (`2`) -> Weight 2.0
4. **Highest confidence** (`3`) -> Weight 3.0 (Shown Last)

If weights tie, it falls back to a stable sequential sort.

## 10. Creative Feature: Weak Spots Report
I added a **Weak Spots Report** tab to the Kit Builder UI. 
- It aggregates the user's `PracticeProgress` (flashcard confidence ratings) and joins them against the core JD `requirements`.
- It calculates the average confidence for each requirement and ranks them by priority: `must-have` requirements with low confidence (or unpracticed) appear at the top.
- This gives users a high-level "Overall Readiness" percentage and a targeted list of what skills they are failing at.

## 11. Key Design Decisions, Trade-offs, and Limitations
- **Optimistic UI vs Truth**: The frontend applies edits to questions optimistically and debounces the server `PATCH`. This makes the UI feel instantaneous, but rapid switching/saving could theoretically get out of sync on slow connections.
- **Coverage Pass Limits**: The `runCoveragePassLoop` caps out at `maxPasses = 3`. This prevents infinite loops and runaway API costs if the LLM stubbornly refuses to generate a question for a malformed requirement.
- **Concurrency Caps**: A strict `p-limit(2)` is used for generation loops. While parallelizing everything would be faster, the Groq free-tier strict token/minute limits would immediately trigger a `429 Too Many Requests` storm.
- **Safety Preambles**: All LLM prompts inject a `SAFETY_PREAMBLE` warning the model to treat JD text and scraped web content strictly as data, mitigating basic prompt-injection attacks.
- **Known Gaps (Out of Scope)**:
  - **Spaced Repetition**: Practice mode orders by immediate confidence but lacks long-term spaced repetition algorithms (like SuperMemo/SM-2).
  - **Auth Flows**: No email verification or password reset logic is included, per explicit assignment scoping.
  - **Batch Evaluation Delay**: The `evaluate` script processes cases sequentially rather than in parallel. A bulk parallel upload would instantly blow through LLM rate limits.

## 12. Edge Cases and Failure Handling
The system handles degraded inputs and failures gracefully, prioritizing honesty over hallucination:
- **Invalid/Unreachable URLs**: If the company URL times out, returns a 404, or has no discoverable about/hiring pages, the crawler suppresses the error and returns empty data. The LLM is instructed to output an honest "information unavailable" brief rather than inventing facts.
- **Thin Job Descriptions**: If the JD is a brief stub, `extractRequirements` extracts only the explicit text. The resulting kit will be sparse, strictly avoiding fabricated requirements.
- **Empty Public Discussion**: If the Tavily API finds no relevant discussions, the system proceeds with just the crawler data.
- **Malformed LLM JSON**: `callLlm` strictly validates all output against Zod schemas. If the LLM returns invalid JSON, the wrapper automatically fires a single "correction prompt" with the exact error message before giving up.
- **LLM Rate Limits & Drops**: All LLM calls are wrapped in `executeWithBackoff`, which retries `429 Too Many Requests` up to 5 times. Hard failures (like daily quotas exhausting or `ENOTFOUND` disconnects) correctly fail the pipeline gracefully, emitting a structured error state to the client.
- **Duplicate/Parallel Executions**: Kit generation is idempotent. Generating twice for the same inputs handles state safely, and partial pipeline failures are caught by the overarching orchestrator wrapper to ensure the UI receives a clean "failed" status rather than hanging indefinitely.
- **Extreme Schedules (e.g., 1 day or 60 days)**: The pure-math allocator distributes questions across exactly the requested day count, tightly packing a 1-day schedule and sparsely distributing a 60-day one.
