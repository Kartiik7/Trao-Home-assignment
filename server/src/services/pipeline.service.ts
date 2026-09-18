import { Kit } from "../models/Kit";
import { researchCompany } from "../retrieval/index";
import { generateKitDraft, generateQuestionsForRequirement } from "../generation/index";
import { runCoveragePassLoop } from "../planning/index";
import { allocateSchedule } from "../planning/scheduler";
import { validateKit, type Kit as IKit } from "@ai-interview-prep/types";

export type PipelineCoreResult = 
  | { ok: true; kit: IKit; log: any[] }
  | { ok: false; error: { code: string; message: string }; log: any[] };

/**
 * The core, deterministic pipeline isolated from MongoDB so the batch script can reuse it.
 */
export async function executePipelineCore(
  jd: string,
  company_url: string,
  days: number,
  allowLocal: boolean = false
): Promise<PipelineCoreResult> {
  const log: any[] = [];
  try {
    const companyNameMatch = company_url.match(/https?:\/\/(?:www\.)?([^.]+)/i);
    const company = companyNameMatch ? companyNameMatch[1] : "The Company";

    const research = await researchCompany(company_url, company, { allowLocal });
    log.push({ step: "retrieval", success: true });

    const genResult = await generateKitDraft(jd, research);
    log.push(...genResult.log);
    
    if (!genResult.draft) {
      return { ok: false, error: { code: "GENERATION_FAILED", message: "Failed to generate initial draft" }, log };
    }

    const coveredDraft = await runCoveragePassLoop(
      genResult.draft,
      jd,
      generateQuestionsForRequirement,
      3
    );

    const schedule = allocateSchedule(
      coveredDraft.requirements,
      coveredDraft.questions,
      days
    );

    const finalKit = {
      source: {
        company,
        company_url,
        role: (coveredDraft as any).role?.title || "Engineer",
        location: "Not specified",
        jd_chars: jd.length,
        researched_at: new Date().toISOString(),
        pages_used: research.pages.map(p => p.url),
      },
      company_brief: coveredDraft.brief,
      role: {
        title: (coveredDraft as any).role?.title || company + " Engineer",
        seniority: (coveredDraft as any).role?.seniority || "Mid-level",
        responsibilities: (coveredDraft as any).role?.responsibilities || [],
        requirements: coveredDraft.requirements,
      },
      questions: coveredDraft.questions,
      flashcards: coveredDraft.flashcards,
      schedule,
      coverage: (coveredDraft as any).coverage || { uncovered_requirement_ids: [], passes: 0 },
    };

    const validationResult = validateKit(finalKit);
    if (!validationResult.valid) {
      log.push({ step: "validation", success: false, reason: JSON.stringify(validationResult.errors) });
      return { ok: false, error: { code: "VALIDATION_FAILED", message: "Generated kit failed Zod schema validation." }, log };
    }

    log.push({ step: "validation", success: true });
    return { ok: true, kit: validationResult.data, log };

  } catch (err: any) {
    return { ok: false, error: { code: "UNHANDLED_EXCEPTION", message: err.message || "An unexpected error occurred" }, log };
  }
}

export async function runPipelineAsync(kitDocId: string) {
  try {
    const doc = await Kit.findById(kitDocId);
    if (!doc) {
      console.error(`[Pipeline] Kit ${kitDocId} not found.`);
      return;
    }

    doc.status = "generating";
    await doc.save();

    const { jd, company_url, days } = doc.inputs;

    const result = await executePipelineCore(jd, company_url, days);
    
    doc.generation_log.push(...result.log);
    
    if (result.ok) {
      doc.status = "ready";
      doc.kit_data = result.kit;
      doc.markModified("kit_data"); // Required: Mongoose doesn't track deep changes to Mixed fields
    } else {
      doc.status = "failed";
      doc.error = result.error;
    }
    
    await doc.save();
    console.log(`[Pipeline] Successfully processed Kit ${kitDocId}`);

  } catch (err: any) {
    console.error(`[Pipeline] Fatal wrapper error for Kit ${kitDocId}:`, err);
    try {
      await Kit.findByIdAndUpdate(kitDocId, {
        status: "failed",
        error: { code: "FATAL_ERROR", message: err.message || "Worker crashed" }
      });
    } catch (saveErr) {
      // Ignored
    }
  }
}
