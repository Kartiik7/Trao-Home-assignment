import dotenv from "dotenv";
import path from "path";

// Load environment variables from server/.env (resolve relative to this file, not cwd)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });
