# AI Interview Prep Kit

## Project Overview & Tech Stack
This project is an AI-powered Interview Preparation Kit builder. It takes a Job Description and a company URL, scrapes the web for company context, and uses an LLM to dynamically generate study requirements, interview questions, flashcards, and a day-by-day study schedule.

**Tech Stack**:
- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide React. Chosen for building a fast, modern, responsive UI with optimistic local state.
- **Backend**: Node.js, Express.js. Chosen for lightweight API routing and easy integration with AI SDKs.
- **Database**: MongoDB (Mongoose). Chosen for its flexible document schema, easily accommodating the deeply nested JSON output from the LLMs (Kits, Questions, Flashcards).
- **Validation**: Zod (for both API payloads and enforcing LLM JSON schemas).

## Setup Instructions

### Local Development
1. Ensure MongoDB is running locally on port `27017`.
2. Clone the repository and navigate to the project root.
3. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
4. Setup environment variables:
   - In `server/`, copy `.env.example` to `.env`.
   - Fill in `GROQ_API_KEY` and `TAVILY_API_KEY`.
   - Ensure `JWT_SECRET` is set.
5. Start the servers:
   - Terminal 1: `cd server && npm run dev` (runs on port 5000)
   - Terminal 2: `cd client && npm run dev` (runs on port 3000)
6. Open `http://localhost:3000` in your browser.

### Running the Batch Entry Point
To evaluate the pipeline headlessly on a batch of test inputs, run the following command from the `server` directory:
```bash
cd server
npx tsx scripts/evaluate.ts
```
*(This script bypasses authentication and evaluates the raw AI pipeline locally, writing the outputs to the `results/` folder.)*

## AI & Retrieval
- **LLM Provider**: Groq API using `openai/gpt-oss-20b` (or Groq's Llama endpoints). Chosen for extreme generation speed and reliable JSON-mode outputs.
- **Retrieval Approach**: We use the **Tavily Search API** to fetch top links related to the company's technical blog or engineering culture. We then scrape the raw HTML of those pages using `jsdom` (with `@mozilla/readability` to clean out boilerplate), capping the character limit before injecting it into the LLM context window.

## Generation Pipeline Sequencing
The pipeline executes sequentially in `server/src/services/pipeline.service.ts`:
1. **Research (`researchCompany`)**: Fetches search results and scrapes content.
2. **Brief Generation (`generateCompanyBrief`)**: Condenses the scraped data into a summary.
3. **Requirement Extraction (`extractRequirements`)**: Parses the raw Job Description into distinct skills (Must vs Nice-to-have).
4. **Coverage Loop (`runCoveragePassLoop`)**: Iteratively generates questions targeting specific requirements until all "must-have" requirements are covered by at least 1 question.
5. **Flashcards (`generateFlashcards`)**: Creates quick-study flashcards tied to the requirements.
6. **Schedule Allocation (`allocateSchedule`)**: Distributes the generated questions evenly across the user's available days.

## State Management (Generated, Edited, Pinned)
Every editable item (Questions, Flashcards, Company Brief) carries a `_meta` object: `{ origin: "generated" | "edited" | "manual", pinned: boolean }`.
- When the LLM generates an item, it is unpinned.
- When a user edits the text of an item, or changes its category, the frontend sends a PATCH request. The server deeply compares the text to the original and upgrades `origin` to `"edited"` and sets `pinned: true`.
- If a user clicks "Regenerate Unpinned", a pure function (`mergeRegeneratedSection`) discards all unpinned items in that category, merges in the newly generated items, and safely preserves all pinned items.

## Schedule Allocation
The `allocateSchedule` function sorts all questions (prioritizing "must-have" requirement coverage first) and distributes them round-robin into buckets corresponding to the number of available days. It calculates daily study time by assuming a flat 3 minutes per question.

## Creative Feature: Weak Spots Report
I added a **Weak Spots Report** tab to the Kit Builder UI. 
- It aggregates the user's `PracticeProgress` (flashcard confidence ratings) and joins them against the core JD `requirements`.
- It calculates the average confidence for each requirement and ranks them by priority: `must-have` requirements with low confidence (or unpracticed) appear at the top.
- This gives users a high-level "Overall Readiness" percentage and a targeted list of what skills they are failing at.

## Key Design Decisions & Known Limitations
- **Optimistic UI vs Truth**: The frontend applies edits to questions optimistically and debounces the server `PATCH`. This makes the UI feel instantaneous, but rapid switching/saving could theoretically get out of sync on slow connections.
- **Safety Preambles**: All LLM prompts inject a `SAFETY_PREAMBLE` warning the model to treat JD text and scraped web content strictly as data, mitigating basic prompt-injection attacks.
- **Limitation**: `jsdom` scraping is synchronous and struggles with heavily client-rendered SPA websites where the content requires JavaScript execution to load.
- **LLM Rate Limits**: Generating questions in a loop easily triggers HTTP 429 Rate Limits. This was mitigated by implementing an exponential backoff wrapper (`executeWithBackoff`) in the `llmClient`.
