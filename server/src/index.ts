import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./db";

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── Routes ───

/** Health check endpoint. */
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── Start Server ───

async function main() {
  // Connect to MongoDB
  await connectDB();

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
