import mongoose, { Schema, Document } from "mongoose";

export interface IPracticeProgressDoc extends Document {
  userId: mongoose.Types.ObjectId;
  kitId: mongoose.Types.ObjectId;
  flashcard_id: string;
  last_confidence: 1 | 2 | 3;
  times_seen: number;
  last_seen_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PracticeProgressSchema = new Schema<IPracticeProgressDoc>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kitId: { type: Schema.Types.ObjectId, ref: "Kit", required: true },
    flashcard_id: { type: String, required: true },
    last_confidence: { type: Number, enum: [1, 2, 3], required: true },
    times_seen: { type: Number, default: 0 },
    last_seen_at: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound unique index for fast upserts per flashcard
PracticeProgressSchema.index(
  { userId: 1, kitId: 1, flashcard_id: 1 },
  { unique: true }
);

export const PracticeProgress = mongoose.model<IPracticeProgressDoc>(
  "PracticeProgress",
  PracticeProgressSchema
);
