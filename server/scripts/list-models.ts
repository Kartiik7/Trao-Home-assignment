import "../src/env";
import Groq from "groq-sdk";
import path from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
  const models = await groq.models.list();
  console.log(models.data.map((m: any) => m.id));
}

main().catch(console.error);
