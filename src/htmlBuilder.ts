// ---------------------------------------------------------------------------
// htmlBuilder.ts — Deterministic HTML slide generation (no LLM)
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { ComputedStatus, ComputedProject, Risk, Health } from "./schema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEMPLATE_PATH = resolve(__dirname, "..", "templates", "executive-slide.html");

const MAX_ITEMS = 7;

// ── Helpers ─────────────────────────────────────────────────────────────────

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function healthBadge(health: Health): string {
  let cls: string;
  let label: string;

  if (health.includes("Green")) {
    cls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    label = "ON-TRACK";
  } else if (health.includes("Yellow")) {
    cls = "bg-amber-50 text-amber-700 border-amber-200";
    label = "AT RISK";
  } else {
    cls = "bg-red-50 text-red-700 border-red-200";
    label = "DELAYED";
  }

  return `<span class="inline-block px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${cls}">${label}</span>`;
}

function progressBarColor(pct: number): string {
  if (pct >= 70) return "bg-brand-500";
  if (pct >= 40) return "bg-amber-400";
  return "bg-red-500";
}

function buildItemList(items: string[]): string {
  if (items.length === 0) {
    return '<li class="text-sm text-gray-400 italic">None</li>';
  }

  const visible = items.slice(0, MAX_ITEMS);
  const overflow = items.length - MAX_ITEMS;

  let html = visible
    .map((item) => `<li class="text-[12px] leading-snug text-gray-600">${esc(item)}</li>`)
    .join("\n              ");

  if (overflow > 0) {
    html += `\n              <li class="text-[11px] text-gray-400 italic mt-1">+${overflow} more</li>`;
  }

  return html;
}

function severityTag(severity: string): string {
  const map: Record<string, string> = {
    High: "text-red-700 bg-red-50 border border-red-200",
    Medium: "text-amber-700 bg-amber-50 border border-amber-200",
    Low: "text-emerald-700 bg-emerald-50 border border-emerald-200",
  };
  const cls = map[severity] ?? map.Medium;
  return `<span class="text-[9px] font-bold uppercase tracking-widest ${cls} px-2 py-0.5 rounded">${severity.toUpperCase()}</span>`;
}

function buildRiskPills(risks: Risk[]): string {
  if (risks.length === 0) return "";

  const pills = risks
    .map(
      (r) => `
          <div class="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
            ${severityTag(r.severity)}
            <span class="text-[11px] text-gray-500">${esc(r.title)}</span>
          </div>`,
    )
    .join("\n");

  return `
      <div class="flex flex-wrap gap-2 mt-3 shrink-0">
        ${pills}
      </div>`;
}

// ── Project Card ────────────────────────────────────────────────────────────

function buildProjectCard(p: ComputedProject): string {
  return `
    <section class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex flex-col flex-1 min-h-0">
      <!-- Project Header -->
      <div class="flex items-center justify-between mb-2 shrink-0">
        <h2 class="text-[20px] font-semibold tracking-tight text-gray-800">${esc(p.project)}</h2>
        <div class="flex items-center gap-4">
          ${healthBadge(p.health)}
          <span class="text-xl font-bold text-brand-700 tabular-nums">${p.progress}<span class="text-sm font-normal text-gray-400">%</span></span>
        </div>
      </div>

      <!-- Progress Bar -->
      <div class="w-full bg-gray-100 rounded-full h-1.5 mb-4 shrink-0">
        <div class="${progressBarColor(p.progress)} h-1.5 rounded-full transition-all" style="width:${p.progress}%"></div>
      </div>

      <!-- Three Columns: Delivered | In Progress | Next -->
      <div class="grid grid-cols-3 gap-3 flex-1 min-h-0">
        <div class="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3 overflow-hidden">
          <h3 class="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-600 mb-2">Delivered</h3>
          <ul class="space-y-1 list-none">
              ${buildItemList(p.done)}
          </ul>
        </div>
        <div class="bg-amber-50/60 border border-amber-100 rounded-lg p-3 overflow-hidden">
          <h3 class="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-2">In Progress</h3>
          <ul class="space-y-1 list-none">
              ${buildItemList(p.doing)}
          </ul>
        </div>
        <div class="bg-blue-50/60 border border-blue-100 rounded-lg p-3 overflow-hidden">
          <h3 class="text-[10px] font-bold uppercase tracking-[0.15em] text-blue-600 mb-2">Next</h3>
          <ul class="space-y-1 list-none">
              ${buildItemList(p.next)}
          </ul>
        </div>
      </div>

      <!-- Risks -->
      ${buildRiskPills(p.risks)}
    </section>`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build the executive HTML slide from precomputed status data.
 * Reads the template from `templates/executive-slide.html` and injects content.
 */
export async function buildHtml(status: ComputedStatus): Promise<string> {
  const template = await readFile(TEMPLATE_PATH, "utf-8");

  const projectsHtml = status.projects
    .map((p) => buildProjectCard(p))
    .join("\n");

  return template
    .replace("{{CLIENT}}", esc(status.client))
    .replace("{{WEEK}}", esc(status.week))
    .replace("{{PROJECTS}}", projectsHtml);
}
