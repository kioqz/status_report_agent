// ---------------------------------------------------------------------------
// logic.ts — Deterministic business rules (zero LLM dependency)
// ---------------------------------------------------------------------------

import type { Risk, Health, ProjectInput } from "./schema.js";

/**
 * Return the current ISO week string in the form `YYYY-Www`.
 * Example: `2026-W07`.
 */
export function currentISOWeek(): string {
  const d = new Date();
  // Shift to nearest Thursday (ISO week date algorithm)
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Calculate project progress as a percentage.
 *
 * - Uses `progress_override` when explicitly provided.
 * - Otherwise derives from done / (done + doing + next).
 * - Returns an integer 0–100.
 */
export function calculateProgress(project: ProjectInput): number {
  if (project.progress_override !== undefined && project.progress_override !== null) {
    return Math.round(Math.min(100, Math.max(0, project.progress_override)));
  }

  const total = project.done.length + project.doing.length + project.next.length;
  if (total === 0) return 0;

  return Math.round((project.done.length / total) * 100);
}

/**
 * Derive project health deterministically from risk severity counts.
 *
 * Rules:
 *   2+ High   → 🔴 Red
 *   1 High OR 2+ Medium → 🟡 Yellow
 *   Otherwise → 🟢 Green
 */
export function calculateHealth(risks: Risk[]): Health {
  const highCount = risks.filter((r) => r.severity === "High").length;
  const mediumCount = risks.filter((r) => r.severity === "Medium").length;

  if (highCount >= 2) return "🔴 Red";
  if (highCount === 1 || mediumCount >= 2) return "🟡 Yellow";
  return "🟢 Green";
}
