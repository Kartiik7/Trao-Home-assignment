import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { Kit } from "../models/Kit";
import { runPipelineAsync } from "../services/pipeline.service";
import { validateKit, type Kit as IKit } from "@ai-interview-prep/types";
import { allocateSchedule } from "../planning/scheduler";
import { mergeRegeneratedSection } from "../planning/merge";
import { researchCompany } from "../retrieval/index";
import { generateCompanyBrief, generateQuestionsForRequirement } from "../generation/index";
import { isAuthConfigError } from "../generation/llmClient";
import { runCoveragePassLoop } from "../planning/index";
import { checkCoverage } from "../planning/coverage";
import { PracticeProgress } from "../models/PracticeProgress";
import { orderPracticeSession } from "../planning/practice";
import { analyzeWeakSpots } from "../planning/weakSpots";

const router = Router();

// Protect all routes
router.use(requireAuth);

const CreateKitInputSchema = z.object({
  jd: z.string().min(10, "Job description must be at least 10 characters"),
  company_url: z.string().url("Must be a valid URL"),
  days: z.number().int().min(1).max(100).default(7),
});

/**
 * POST /kits
 * Submits a new JD for kit generation.
 * Handles deduplication asynchronously.
 */
router.post("/", async (req, res) => {
  try {
    const parsed = CreateKitInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.format() });
      return;
    }

    const { jd, company_url, days } = parsed.data;
    const jdHash = crypto.createHash("sha256").update(jd).digest("hex");

    // Check for exact duplicate first (Race condition fallback is the unique index)
    const existing = await Kit.findOne({
      userId: req.userId,
      "inputs.jdHash": jdHash,
      "inputs.company_url": company_url,
    });

    if (existing) {
      res.status(200).json({ 
        message: "Duplicate kit found, returning existing kit.",
        kitId: existing._id,
        status: existing.status
      });
      return;
    }

    // Create new Kit document as pending
    const newKit = new Kit({
      userId: req.userId,
      status: "pending",
      inputs: { jd, company_url, days, jdHash },
    });

    await newKit.save();

    // Fire and forget the pipeline worker
    runPipelineAsync(newKit._id.toString()).catch((err) => {
      console.error("[Fatal Worker Error]", err);
    });

    res.status(201).json({
      message: "Kit generation started.",
      kitId: newKit._id,
      status: "pending",
    });
  } catch (err: any) {
    if (err.code === 11000) {
      // Caught the race condition duplicate key error
      const existing = await Kit.findOne({
        userId: req.userId,
        "inputs.jdHash": crypto.createHash("sha256").update(req.body.jd).digest("hex"),
        "inputs.company_url": req.body.company_url,
      });
      res.status(200).json({ 
        message: "Duplicate kit found, returning existing kit.",
        kitId: existing?._id,
        status: existing?.status
      });
    } else {
      console.error("[POST /kits]", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

/**
 * GET /kits
 * Returns a lightweight list of the user's kits.
 */
router.get("/", async (req, res) => {
  try {
    const kits = await Kit.find({ userId: req.userId })
      .select("_id status kit_data.source.company kit_data.role.title createdAt")
      .sort({ createdAt: -1 });

    res.json({ kits });
  } catch (err) {
    console.error("[GET /kits]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /kits/:id
 * Returns the full kit body if it belongs to the user.
 */
router.get("/:id", async (req, res) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kit) {
      res.status(404).json({ error: "Kit not found" });
      return;
    }

    res.json({ kit });
  } catch (err) {
    console.error("[GET /kits/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /kits/:id/status
 * Lightweight polling endpoint.
 */
router.get("/:id/status", async (req, res) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId })
      .select("status error");
    
    if (!kit) {
      res.status(404).json({ error: "Kit not found" });
      return;
    }

    res.json({ status: kit.status, error: kit.error });
  } catch (err) {
    console.error("[GET /kits/:id/status]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /kits/:id/retry
 * Retries a failed kit generation by bypassing deduplication and re-running the worker.
 */
router.post("/:id/retry", async (req, res) => {
  try {
    const kit = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!kit) {
      res.status(404).json({ error: "Kit not found" });
      return;
    }

    if (kit.status !== "failed") {
      res.status(400).json({ error: "Only failed kits can be retried." });
      return;
    }

    // Reset state
    kit.status = "pending";
    kit.error = undefined;
    await kit.save();

    // Fire and forget pipeline worker on existing doc
    runPipelineAsync(kit._id.toString()).catch((err) => {
      console.error("[Fatal Worker Error on Retry]", err);
    });

    res.json({ message: "Retry started", status: "pending" });
  } catch (err) {
    console.error("[POST /kits/:id/retry]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Phase 6: Editing and Regeneration ───

/**
 * Helper: deep compares text fields to auto-pin edited generated items.
 */
function pinEditedItems(originalItems: any[], updatedItems: any[]) {
  return updatedItems.map(updated => {
    // If it's explicitly manual, just pin it
    if (updated._meta?.origin === "manual") {
      updated._meta.pinned = true;
      return updated;
    }

    const orig = originalItems.find(o => o.id === updated.id);
    if (!orig) {
      // Must be new (but not marked manual? assume manual)
      updated._meta = { origin: "manual", pinned: true };
      return updated;
    }

    if (orig._meta?.origin === "generated") {
      // Compare stringified versions of core fields (cheap deep equal for text)
      const oCopy = { ...orig, _meta: undefined };
      const uCopy = { ...updated, _meta: undefined };
      if (JSON.stringify(oCopy) !== JSON.stringify(uCopy)) {
        updated._meta = { origin: "edited", pinned: true };
      }
    }
    return updated;
  });
}

/**
 * PATCH /kits/:id
 * Partially updates a kit, auto-pins edited items, and recalculates schedule.
 */
router.patch("/:id", async (req, res) => {
  try {
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc || kitDoc.status !== "ready" || !kitDoc.kit_data) {
      res.status(404).json({ error: "Kit not found or not ready" });
      return;
    }

    const updates: Partial<IKit> = req.body;
    let kitData = kitDoc.kit_data as any; // Cast for flexibility before strict Zod check

    if (updates.company_brief) {
      const orig = kitData.company_brief;
      const upd = updates.company_brief;
      if (orig._meta?.origin === "generated") {
        if (orig.summary !== upd.summary || orig.what_they_do !== upd.what_they_do) {
          upd._meta = { origin: "edited", pinned: true };
        }
      } else if (upd._meta?.origin === "manual") {
        upd._meta.pinned = true;
      }
      kitData.company_brief = upd;
    }

    if (updates.questions) {
      // The builder sends the complete question list, so omitted IDs are deletions.
      const nextQuestions = pinEditedItems(kitData.questions, updates.questions);

      try {
        kitData.schedule = allocateSchedule(kitData.role.requirements, nextQuestions, kitDoc.inputs.days);
      } catch (scheduleErr: any) {
        res.status(409).json({
          error: "Can't save this change — a required skill would no longer be covered by any question.",
          reason: scheduleErr?.message,
        });
        return;
      }

      kitData.questions = nextQuestions;

    }

    if (updates.flashcards) {
      kitData.flashcards = pinEditedItems(kitData.flashcards, updates.flashcards);
    }

    // Validate structure after edits
    const valResult = validateKit(kitData);
    if (!valResult.valid) {
      res.status(400).json({ error: "Invalid kit structure", details: valResult.errors });
      return;
    }

    kitDoc.kit_data = valResult.data;
    await kitDoc.save();
    res.json({ kit: kitDoc });

  } catch (err) {
    console.error("[PATCH /kits/:id]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const RegenerateInputSchema = z.object({
  section: z.enum(["company_brief", "questions", "schedule"]),
  category: z.enum(["technical", "behavioural", "system-design", "company-fit"]).optional(),
});

/**
 * POST /kits/:id/regenerate
 * Selectively regenerates parts of the kit.
 */
router.post("/:id/regenerate", async (req, res) => {
  try {
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc || kitDoc.status !== "ready" || !kitDoc.kit_data) {
      res.status(404).json({ error: "Kit not found or not ready" });
      return;
    }

    const parsed = RegenerateInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error });
      return;
    }

    const { section, category } = parsed.data;
    let kitData = kitDoc.kit_data as IKit;

    if (section === "company_brief") {
      if (kitData.company_brief._meta?.pinned) {
        res.status(400).json({ error: "Cannot regenerate a pinned company brief." });
        return;
      }

      // Re-run generation
      const research = await researchCompany(kitDoc.inputs.company_url, kitData.source.company);
      const briefRes = await generateCompanyBrief(research.pages);
      if (!briefRes.ok) {
        if (isAuthConfigError(briefRes.reason, briefRes.details)) {
          res.status(502).json({
            error: "AI Generation failed due to invalid API configuration",
            code: "LLM_AUTH_ERROR",
          });
          return;
        }
        res.status(500).json({ error: "Failed to regenerate brief", reason: briefRes.reason });
        return;
      }
      
      const newBrief = { ...briefRes.data, _meta: { origin: "generated" as const, pinned: false } };
      kitData = mergeRegeneratedSection(kitData, { company_brief: newBrief }, { type: "company_brief" });
    }

    if (section === "questions") {
      if (!category) {
        res.status(400).json({ error: "A category is required to regenerate questions." });
        return;
      }

      const replacementRequirementIds = new Set(
        kitData.questions
          .filter(q => q.category === category && !q._meta?.pinned)
          .flatMap(q => q.requirement_ids)
      );
      const requirementsToRegenerate = kitData.role.requirements.filter(req => replacementRequirementIds.has(req.id));

      // Discard unpinned questions in the target category before replacing them.
      kitData = mergeRegeneratedSection(kitData, { questions: [] }, { type: "questions", category });

      const context = kitData.company_brief.what_they_do; // approximate context for LLM
      const replacementQuestions = [];
      for (const requirement of requirementsToRegenerate) {
        const result = await generateQuestionsForRequirement(requirement, context, { forceCategory: category });
        if (!result.ok) {
          if (isAuthConfigError(result.reason, result.details)) {
            res.status(502).json({
              error: "AI Generation failed due to invalid API configuration",
              code: "LLM_AUTH_ERROR",
            });
            return;
          }
          res.status(500).json({ error: "Failed to regenerate questions", reason: result.reason });
          return;
        }

        replacementQuestions.push(...result.data.map(question => ({
          ...question,
          id: `q_${crypto.randomUUID()}`,
          _meta: { origin: "generated" as const, pinned: false },
        })));
      }

      kitData = mergeRegeneratedSection(
        kitData,
        { questions: replacementQuestions },
        { type: "questions", category }
      );

      // Use coverage only as a safety net for gaps introduced during replacement.
      const replacementCoverage = checkCoverage(kitData.role.requirements, kitData.questions);
      if (replacementCoverage.uncovered_requirement_ids.length > 0) {
        const draft = {
          requirements: kitData.role.requirements,
          brief: kitData.company_brief,
          questions: kitData.questions,
          flashcards: kitData.flashcards,
        };
        const updatedDraft = await runCoveragePassLoop(draft, context, generateQuestionsForRequirement, 3);
        const failures = (updatedDraft as any).coverageFailures as { reason: string; details?: any }[] | undefined;
        if (failures?.length && failures.every(f => isAuthConfigError(f.reason, f.details))) {
          res.status(502).json({
            error: "AI Generation failed due to invalid API configuration",
            code: "LLM_AUTH_ERROR",
          });
          return;
        }
        kitData.questions = updatedDraft.questions;
      }

      // Update Schedule
      kitData.schedule = allocateSchedule(kitData.role.requirements, kitData.questions, kitDoc.inputs.days);
    }

    if (section === "schedule") {
      kitData.schedule = allocateSchedule(kitData.role.requirements, kitData.questions, kitDoc.inputs.days);
    }

    // Validate and save
    const valResult = validateKit(kitData);
    if (!valResult.valid) {
      res.status(500).json({ error: "Regeneration produced invalid structure", details: valResult.errors });
      return;
    }

    kitDoc.kit_data = valResult.data;
    await kitDoc.save();

    res.json({ kit: kitDoc });
  } catch (err) {
    console.error("[POST /kits/:id/regenerate]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Phase 7: Practice Mode ───

/**
 * GET /kits/:id/practice
 * Returns the ordered flashcards for the next session and stats.
 */
router.get("/:id/practice", async (req, res) => {
  try {
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc || kitDoc.status !== "ready" || !kitDoc.kit_data) {
      res.status(404).json({ error: "Kit not found or not ready" });
      return;
    }

    const flashcards = kitDoc.kit_data.flashcards;
    
    const records = await PracticeProgress.find({ 
      userId: req.userId, 
      kitId: kitDoc._id 
    });

    const ordered_flashcards = orderPracticeSession(flashcards, records);

    const total_cards = flashcards.length;
    const cards_seen = records.filter(r => r.times_seen > 0).length;
    const cards_unseen = total_cards - cards_seen;
    
    let avg_confidence = 0;
    if (cards_seen > 0) {
      const sum = records.reduce((acc, r) => acc + (r.last_confidence || 0), 0);
      avg_confidence = sum / cards_seen;
    }

    res.json({
      ordered_flashcards,
      stats: {
        total_cards,
        cards_seen,
        cards_unseen,
        average_confidence: avg_confidence
      }
    });

  } catch (err) {
    console.error("[GET /kits/:id/practice]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /kits/:id/practice
 * Records a confidence rating for a flashcard.
 */
router.post("/:id/practice", async (req, res) => {
  try {
    const { flashcard_id, confidence } = req.body;
    
    if (![1, 2, 3].includes(confidence) || !flashcard_id) {
      res.status(400).json({ error: "Invalid confidence rating or missing flashcard_id." });
      return;
    }

    // Verify the kit exists and belongs to this user before recording progress against it
    const kitExists = await Kit.exists({ _id: req.params.id, userId: req.userId });
    if (!kitExists) {
      res.status(404).json({ error: "Kit not found" });
      return;
    }

    // Upsert the progress record
    await PracticeProgress.findOneAndUpdate(
      { 
        userId: req.userId, 
        kitId: req.params.id, 
        flashcard_id 
      },
      { 
        $set: { last_confidence: confidence, last_seen_at: new Date() },
        $inc: { times_seen: 1 }
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[POST /kits/:id/practice]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /kits/:id/weak-spots
 * Returns the weak spots report for the kit based on practice progress.
 */
router.get("/:id/weak-spots", async (req, res) => {
  try {
    const kitDoc = await Kit.findOne({ _id: req.params.id, userId: req.userId });
    if (!kitDoc || kitDoc.status !== "ready" || !kitDoc.kit_data) {
      res.status(404).json({ error: "Kit not found or not ready" });
      return;
    }

    const records = await PracticeProgress.find({ 
      userId: req.userId, 
      kitId: kitDoc._id 
    });

    const report = analyzeWeakSpots(
      kitDoc.kit_data.role.requirements,
      kitDoc.kit_data.flashcards,
      records
    );

    res.json(report);
  } catch (err) {
    console.error("[GET /kits/:id/weak-spots]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
