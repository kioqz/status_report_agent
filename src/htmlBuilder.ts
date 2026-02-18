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

// ── Highlights Section ──────────────────────────────────────────────────────

function buildHighlightsSection(highlights: string[]): string {
  if (highlights.length === 0) return "";

  const items = highlights
    .map(
      (h) => `
        <div class="flex items-start gap-2">
          <svg class="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
          </svg>
          <span class="text-[12px] text-gray-700">${esc(h)}</span>
        </div>`,
    )
    .join("\n");

  return `
    <section class="bg-white border border-amber-200 rounded-xl p-5 shadow-sm">
      <h2 class="text-[14px] font-bold uppercase tracking-[0.15em] text-amber-600 mb-3 flex items-center gap-2">
        <svg class="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
        Highlights
      </h2>
      <div class="grid grid-cols-2 gap-x-6 gap-y-2">
        ${items}
      </div>
    </section>`;
}

// ── Jira Screenshot Section ─────────────────────────────────────────────────

function buildJiraSection(jiraScreenshot?: string): string {
  if (!jiraScreenshot) return "";

  return `
    <section class="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 class="text-[14px] font-bold uppercase tracking-[0.15em] text-brand-600 mb-3 flex items-center gap-2">
        <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        Jira Board
      </h2>
      <div class="flex justify-center">
        <img src="${jiraScreenshot}" alt="Jira Board Screenshot" class="max-h-[320px] rounded-lg border border-gray-200 shadow-sm object-contain" />
      </div>
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

  const highlightsHtml = buildHighlightsSection(status.highlights);
  const jiraHtml = buildJiraSection(status.jiraScreenshot);

  return template
    .replace("{{CLIENT}}", esc(status.client))
    .replace("{{WEEK}}", esc(status.week))
    .replace("{{HIGHLIGHTS}}", highlightsHtml)
    .replace("{{PROJECTS}}", projectsHtml)
    .replace("{{JIRA}}", jiraHtml);
}
