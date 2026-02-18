// ---------------------------------------------------------------------------
// agent.ts — Executive Slide Rendering Engine
//
// Flow:  Input → Agent → LLM (normalisation) → Metrics → HTML Builder → PNG
// ---------------------------------------------------------------------------

import { CopilotClient } from "@github/copilot-sdk";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type {
  WeeklyStatusInput,
  ProjectInput,
  NormalizedOutput,
  NormalizedProject,
  ComputedStatus,
  ComputedProject,
  Severity,
} from "./schema.js";
import { calculateProgress, calculateHealth } from "./logic.js";
import { buildHtml } from "./htmlBuilder.js";
import { renderToPng } from "./renderer.js";
import { buildIndex } from "./indexBuilder.js";
import { loadSystemPrompt, buildUserMessage } from "./prompt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Validation ──────────────────────────────────────────────────────────────

const VALID_SEVERITIES: Set<string> = new Set(["Low", "Medium", "High"]);

/** Validate that the raw input contains all required fields. */
function validateInput(input: unknown): asserts input is WeeklyStatusInput {
  const obj = input as Record<string, unknown>;

  if (typeof obj.week !== "string")   throw new Error("Missing required field: week");
  if (typeof obj.client !== "string") throw new Error("Missing required field: client");
  if (!Array.isArray(obj.projects) || obj.projects.length === 0)
    throw new Error("Missing required field: projects (must be a non-empty array)");

  for (const p of obj.projects as Record<string, unknown>[]) {
    if (typeof p.project !== "string") throw new Error("Each project must have a 'project' name");
    if (!Array.isArray(p.done))  throw new Error(`Missing 'done' in project "${p.project}"`);
    if (!Array.isArray(p.doing)) throw new Error(`Missing 'doing' in project "${p.project}"`);
    if (!Array.isArray(p.next))  throw new Error(`Missing 'next' in project "${p.project}"`);
    if (!Array.isArray(p.risks)) throw new Error(`Missing 'risks' in project "${p.project}"`);

    for (const risk of p.risks as { severity?: string }[]) {
      if (!VALID_SEVERITIES.has(risk.severity ?? "")) {
        throw new Error(`Invalid severity "${risk.severity}" — expected Low, Medium, or High`);
      }
    }
  }
}

/** Safely parse the NormalizedOutput returned by the LLM. */
function parseNormalized(raw: string): NormalizedOutput {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as NormalizedOutput;

  if (!Array.isArray(parsed.projects)) throw new Error("LLM response missing 'projects'");

  for (const p of parsed.projects) {
    if (!Array.isArray(p.done))  throw new Error("LLM project response missing 'done'");
    if (!Array.isArray(p.doing)) throw new Error("LLM project response missing 'doing'");
    if (!Array.isArray(p.next))  throw new Error("LLM project response missing 'next'");
    if (!Array.isArray(p.risks)) throw new Error("LLM project response missing 'risks'");

    for (const risk of p.risks) {
      if (!VALID_SEVERITIES.has(risk.severity)) {
        risk.severity = "Medium" as Severity;
      }
    }
  }

  return parsed;
}

// ── Agent Core ──────────────────────────────────────────────────────────────

/**
 * Run the full agent pipeline:
 *   1. Validate input
 *   2. Send raw content to LLM for text normalization
 *   3. Parse structured JSON response
 *   4. Calculate deterministic progress & health per project
 *   5. Build executive HTML slide
 *   6. Return HTML string
 */
export async function runAgent(input: WeeklyStatusInput): Promise<string> {
  // ── 1. Validate ──────────────────────────────────────────
  validateInput(input);

  // ── 2. Prepare LLM call ──────────────────────────────────
  const systemPrompt = await loadSystemPrompt();
  const userMessage = buildUserMessage(input);

  const client = new CopilotClient();
  await client.start();

  try {
    const session = await client.createSession({
      model: "gpt-5",
      systemMessage: { mode: "replace", content: systemPrompt },
    });

    const responsePromise = new Promise<string>((resolve, reject) => {
      let content = "";
      session.on("assistant.message", (event) => {
        content += event.data.content;
      });
      session.on("session.idle", () => resolve(content));
      session.on("session.error", (err) => reject(err));
    });

    await session.send({ prompt: userMessage });
    const llmResponse = await responsePromise;
    await session.destroy();

    // ── 3. Parse LLM output ──────────────────────────────────
    const normalized = parseNormalized(llmResponse);

    // ── 4. Deterministic computations per project ────────────
    const computedProjects: ComputedProject[] = input.projects.map(
      (orig: ProjectInput, idx: number) => {
        const norm: NormalizedProject = normalized.projects[idx] ?? {
          project: orig.project,
          done: orig.done,
          doing: orig.doing,
          next: orig.next,
          risks: orig.risks,
        };

        return {
          project: orig.project,
          done: norm.done,
          doing: norm.doing,
          next: norm.next,
          risks: norm.risks,
          progress: calculateProgress(orig),
          health: calculateHealth(norm.risks),
        };
      },
    );

    const computed: ComputedStatus = {
      week: input.week,
      client: input.client,
      projects: computedProjects,
      highlights: input.highlights ?? [],
      jiraScreenshot: input.jiraScreenshot,
    };

    // ── 5. Build HTML slide ──────────────────────────────────
    return await buildHtml(computed);
  } finally {
    await client.stop();
  }
}

// ── Shared report generation ────────────────────────────────────────────────

export interface ReportResult {
  htmlPath: string;
  pngPath: string;
  weekDir: string;
}

/**
 * Full end-to-end report generation:
 *   runAgent → write HTML → render PNG → rebuild index
 */
export async function generateReport(
  input: WeeklyStatusInput,
  outputDir: string,
): Promise<ReportResult> {
  const html = await runAgent(input);

  const weekDir = resolve(outputDir, input.week);
  await mkdir(weekDir, { recursive: true });

  const htmlPath = resolve(weekDir, "status.html");
  const pngPath = resolve(weekDir, "status.png");

  const inputJsonPath = resolve(weekDir, "input.json");
  await writeFile(inputJsonPath, JSON.stringify(input, null, 2), "utf-8");
  await writeFile(htmlPath, html, "utf-8");
  await renderToPng(html, pngPath);
  await buildIndex(outputDir);

  return { htmlPath, pngPath, weekDir };
}

// ── CLI entry point ─────────────────────────────────────────────────────────

async function main() {
  const sampleInput: WeeklyStatusInput = {
    week: "2026-W07",
    client: "Gubertech DevOps Team - Amyris",
    highlights: [
      "Successfully migrated 12 legacy services to AKS with zero downtime",
      "P99 latency improved 57% — from 420ms to 180ms after platform modernization",
      "Completed security audit and IAM policy hardening across all environments",
    ],
    projects: [
      {
        project: "Cloud Migration Phase 2",
        done: [
          "Migrated 12 legacy services from on-prem VMs to AKS containers",
          "Completed SSO integration with Azure AD for all internal tooling",
          "Delivered automated backup strategy for PostgreSQL clusters in prod",
        ],
        doing: [
          "Building observability dashboards in Grafana for the new container fleet",
          "Refactoring the event bus from RabbitMQ to Azure Service Bus — 60% complete",
        ],
        next: [
          "Define disaster recovery runbook for containerised workloads",
          "Onboard QA team to the new staging environment",
          "Prepare executive demo for the steering committee on Feb 20",
        ],
        risks: [
          { title: "Azure region capacity constraints may delay GPU workload migration", severity: "High" },
          { title: "Shared library version conflict between service mesh and API gateway", severity: "Medium" },
        ],
      },
      {
        project: "Platform Modernization",
        done: [
          "Migrated auth service to new Kubernetes cluster (PLAT-1024)",
          "Completed load testing — p99 latency improved from 420ms to 180ms",
          "Deployed updated Terraform modules for staging environment v2.3.1",
          "Finished security audit for IAM policies and service accounts",
        ],
        doing: [
          "CI/CD pipeline refactoring from Jenkins to GitHub Actions — 60% done",
          "Integrating Datadog APM with new microservices mesh",
        ],
        next: [
          "Blue-green deployment setup for production release 3.0",
          "Capacity review meeting with cloud team for Q2 budget",
        ],
        risks: [
          { title: "Vendor delay on networking appliance firmware update — may block prod cutover", severity: "High" },
          { title: "Two senior SREs on PTO next week — reduced on-call coverage", severity: "Medium" },
          { title: "Minor dependency version drift in shared libraries", severity: "Low" },
        ],
      },
    ],
  };

  const outputDir = resolve(__dirname, "..", "output");

  console.log("Executive Slide Rendering Engine");
  console.log("================================\n");

  console.log("1. Running agent + rendering report...");
  const result = await generateReport(sampleInput, outputDir);

  const indexPath = resolve(outputDir, "index.html");
  console.log(`\nDone!`);
  console.log(`  HTML   ->  ${result.htmlPath}`);
  console.log(`  PNG    ->  ${result.pngPath}`);
  console.log(`  Index  ->  ${indexPath}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("Agent failed:", err);
    process.exit(1);
  });
}
