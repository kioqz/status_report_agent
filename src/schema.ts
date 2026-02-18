// ---------------------------------------------------------------------------
// schema.ts — Typed contracts for the DevOps Weekly Status Agent
// ---------------------------------------------------------------------------

/** Severity levels accepted by the system. */
export type Severity = "Low" | "Medium" | "High";

/** A single risk entry. */
export interface Risk {
  title: string;
  severity: Severity;
}

/** A single project's raw input data. */
export interface ProjectInput {
  project: string;
  done: string[];
  doing: string[];
  next: string[];
  risks: Risk[];
  progress_override?: number | null;
}

/** Raw input provided by the user or upstream system (multi-project). */
export interface WeeklyStatusInput {
  week: string;
  client: string;
  projects: ProjectInput[];
  highlights?: string[];
  jiraScreenshot?: string;
}

/** Normalized project output returned by the LLM (structured JSON only). */
export interface NormalizedProject {
  project: string;
  done: string[];
  doing: string[];
  next: string[];
  risks: Risk[];
}

/** Normalized output returned by the LLM. */
export interface NormalizedOutput {
  projects: NormalizedProject[];
}

/** Health indicator derived deterministically from risk data. */
export type Health = "🟢 Green" | "🟡 Yellow" | "🔴 Red";

/** Fully computed status for a single project. */
export interface ComputedProject {
  project: string;
  done: string[];
  doing: string[];
  next: string[];
  risks: Risk[];
  progress: number;
  health: Health;
}

/** Fully computed status passed to the Mermaid builder. */
export interface ComputedStatus {
  week: string;
  client: string;
  projects: ComputedProject[];
  highlights: string[];
  jiraScreenshot?: string;
}
