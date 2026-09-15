// ─── Appendix B: Batch Input/Output Shapes ───

import type { Kit } from "./kit";

/** A single input case in the batch JSON array. */
export interface BatchInputCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

/** Error detail for a failed kit generation. */
export interface BatchOutputError {
  code: string;
  message: string;
}

/** A single kit result in the batch output. */
export interface BatchOutputKit {
  id: string;
  status: "ok" | "failed";
  kit: Kit | null;
  error: BatchOutputError | null;
}

/** The full batch output file structure. */
export interface BatchOutput {
  version: string;
  generated_at: string;
  kits: BatchOutputKit[];
}
