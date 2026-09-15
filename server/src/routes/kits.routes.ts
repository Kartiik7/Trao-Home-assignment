import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middleware/requireAuth";
import { Kit } from "../models/Kit";
import { runPipelineAsync } from "../services/pipeline.service";

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

export default router;
