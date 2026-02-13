// ---------------------------------------------------------------------------
// prompt.ts — System prompt loader and user-message builder
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { WeeklyStatusInput } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Load the system prompt from prompt.md (project root). */
export async function loadSystemPrompt(): Promise<string> {
  const promptPath = resolve(__dirname, "..", "prompt.md");
  return readFile(promptPath, "utf-8");
}

/**
 * Build the user message that the LLM will normalize.
 * Supports multiple projects — each project is a named section.
 */
export function buildUserMessage(input: WeeklyStatusInput): string {
  const lines: string[] = [];

  for (const p of input.projects) {
    lines.push(`=== Project: ${p.project} ===`);

    lines.push("Delivered:");
    p.done.forEach((d) => lines.push(`- ${d}`));

    lines.push("");
    lines.push("In Progress:");
    p.doing.forEach((d) => lines.push(`- ${d}`));

    lines.push("");
    lines.push("Next:");
    p.next.forEach((n) => lines.push(`- ${n}`));

    lines.push("");
    lines.push("Risks:");
    p.risks.forEach((r) => lines.push(`- [${r.severity}] ${r.title}`));

    lines.push("");
  }

  return lines.join("\n");
}
