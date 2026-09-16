import "./env"; // MUST be first import — loads .env before any module (e.g. generation/llmClient.ts) reads process.env at import time
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./db";
import authRouter from "./routes/auth.routes";
import kitsRouter from "./routes/kits.routes";

const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// ─── Middleware ───
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true, // allow cookies to be sent cross-origin
  })
);
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───

/** Health check endpoint. */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/** Auth routes. */
app.use("/auth", authRouter);

/** Kits routes (generation and fetching) */
app.use("/kits", kitsRouter);

// ─── Start Server ───

async function main() {
  // Connect to MongoDB
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   CORS origin:  ${CLIENT_URL}`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
