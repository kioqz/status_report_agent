// ---------------------------------------------------------------------------
// server.ts — Hono web server for the Executive Slide Rendering Engine
//
// Routes:
//   GET  /                → Dashboard with integrated input form
//   GET  /output/*        → Static files (weekly reports)
//   POST /api/reports     → Generate a new report from JSON input
//   GET  /api/weeks       → List available week reports
// ---------------------------------------------------------------------------

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile } from "node:fs/promises";

import type { WeeklyStatusInput } from "./schema.js";
import { generateReport } from "./agent.js";
import { currentISOWeek } from "./logic.js";
import { scanWeeks, buildDashboardHtml } from "./dashboard.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, "..", "output");

const app = new Hono();

// ── Static files for generated reports ──────────────────────────────────────

app.use(
  "/output/*",
  serveStatic({
    root: resolve(__dirname, ".."),
    rewriteRequestPath: (path) => path,
  }),
);

// ── Dashboard ───────────────────────────────────────────────────────────────

app.get("/", async (c) => {
  const entries = await scanWeeks(OUTPUT_DIR);
  const week = currentISOWeek();
  const html = buildDashboardHtml(entries, week);
  return c.html(html);
});

// ── API: List weeks ─────────────────────────────────────────────────────────

app.get("/api/weeks", async (c) => {
  const entries = await scanWeeks(OUTPUT_DIR);
  return c.json(entries);
});

// ── API: Generate report ────────────────────────────────────────────────────

app.post("/api/reports", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const input = body as WeeklyStatusInput;

  // Basic validation before sending to the agent
  if (!input.week || typeof input.week !== "string") {
    return c.json({ error: "Missing or invalid 'week' field" }, 400);
  }
  if (!input.client || typeof input.client !== "string") {
    return c.json({ error: "Missing or invalid 'client' field" }, 400);
  }
  if (!Array.isArray(input.projects) || input.projects.length === 0) {
    return c.json({ error: "Must include at least one project" }, 400);
  }

  for (const p of input.projects) {
    if (!p.project || typeof p.project !== "string") {
      return c.json({ error: "Each project must have a 'project' name" }, 400);
    }
    if (!Array.isArray(p.done)) p.done = [];
    if (!Array.isArray(p.doing)) p.doing = [];
    if (!Array.isArray(p.next)) p.next = [];
    if (!Array.isArray(p.risks)) p.risks = [];
  }

  try {
    console.log(`[report] Generating report for ${input.week} (${input.projects.length} projects)...`);
    const t0 = Date.now();

    const result = await generateReport(input, OUTPUT_DIR);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`[report] Done in ${elapsed}s → ${result.weekDir}`);

    return c.json({
      success: true,
      week: input.week,
      htmlPath: `/output/${input.week}/status.html`,
      pngPath: `/output/${input.week}/status.png`,
      elapsed: Number(elapsed),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[report] Error:`, message);
    return c.json({ error: message }, 500);
  }
});

// ── Start server ────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 3000;

serve(
  { fetch: app.fetch, port: PORT },
  (info) => {
    console.log("");
    console.log("╔══════════════════════════════════════════════════╗");
    console.log("║   DevOps Weekly Reports — Web Server            ║");
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║   http://localhost:${info.port}                        ║`);
    console.log("╚══════════════════════════════════════════════════╝");
    console.log("");
  },
);
