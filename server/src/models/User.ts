import mongoose, { Document, Schema } from "mongoose";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export interface IUser extends Document {
  email: string;
  password: string;
  createdAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  toAuthUser(): { id: string; email: string; createdAt: string };
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─── Pre-save: hash password if modified ───
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err as Error);
  }
});

// ─── Instance methods ───

userSchema.methods.comparePassword = async function (
  candidate: string
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toAuthUser = function () {
  return {
    id: this._id.toString(),
    email: this.email,
    createdAt: this.createdAt.toISOString(),
  };
};

// Never return password in JSON
userSchema.set("toJSON", {
  transform(_doc, ret) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = ret as any;
    delete obj.password;
    delete obj.__v;
    return obj;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
