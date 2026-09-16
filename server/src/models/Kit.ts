import mongoose, { Schema, Document } from "mongoose";
import crypto from "crypto";
import type { Kit as IKit } from "@ai-interview-prep/types";

export interface IKitDoc extends Document {
  userId: mongoose.Types.ObjectId;
  status: "pending" | "generating" | "ready" | "failed";
  inputs: {
    jd: string;
    company_url: string;
    days: number;
    jdHash: string; // for unique indexing
  };
  error?: {
    code: string;
    message: string;
  };
  generation_log: Array<{ step: string; success: boolean; reason?: string }>;
  kit_data?: IKit; // Mixed type for the finalized kit
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<IKitDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "generating", "ready", "failed"],
      default: "pending",
    },
    inputs: {
      jd: { type: String, required: true },
      company_url: { type: String, required: true },
      days: { type: Number, required: true },
      jdHash: { type: String, required: true },
    },
    error: {
      code: { type: String },
      message: { type: String },
    },
    generation_log: { type: Schema.Types.Mixed, default: [] },
    kit_data: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Pre-validate hook to automatically generate jdHash
KitSchema.pre("validate", function (next) {
  const doc = this as any;
  if (doc.inputs && doc.inputs.jd && !doc.inputs.jdHash) {
    doc.inputs.jdHash = crypto
      .createHash("sha256")
      .update(doc.inputs.jd)
      .digest("hex");
  }
  next();
});

// Compound unique index for deduplication: same user + same jd + same company
KitSchema.index(
  { userId: 1, "inputs.jdHash": 1, "inputs.company_url": 1 },
  { unique: true }
);

export const Kit = mongoose.model<IKitDoc>("Kit", KitSchema);
