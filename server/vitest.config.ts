import { defineConfig } from "vitest/config";

const isGolden = process.env.npm_lifecycle_event === "test:golden" || process.argv.some(arg => arg.includes("golden.eval"));

export default defineConfig({
  test: {
    exclude: isGolden ? ["node_modules/**", "dist/**"] : ["evals/**", "node_modules/**", "dist/**"],
  },
});
