# DevOps Weekly Agent

Enterprise deterministic DevOps weekly status agent powered by the GitHub Copilot SDK.

## Architecture

```
Input → Agent → LLM (normalization only) → Backend Mermaid Builder → Output Mermaid
```

| Layer | Responsibility |
|---|---|
| **Input** | Raw weekly status data (typed `WeeklyStatusInput`) |
| **Agent** | Orchestration, validation, pipeline control |
| **LLM** | Text normalization only — shorten, clean, executive tone |
| **Logic** | Deterministic progress & health calculation |
| **Mermaid Builder** | Fixed-template flowchart generation (no LLM) |

The LLM **never** generates Mermaid. All diagram output is built deterministically in the backend.

## Project Structure

```
devops-weekly-agent/
├── src/
│   ├── agent.ts            # Agent orchestration & pipeline
│   ├── schema.ts           # TypeScript interfaces & types
│   ├── logic.ts            # Deterministic business rules
│   ├── mermaidBuilder.ts   # Fixed-template Mermaid generator
│   ├── prompt.ts           # System prompt loader & message builder
│   └── run.ts              # Local runner script
├── prompt.md               # LLM system prompt (normalization only)
├── package.json
├── tsconfig.json
└── README.md
```

## Installation

```bash
npm install
```

## Usage

### Build

```bash
npm run build
```

### Run with sample data

```bash
npm start
```

### Run local runner (customizable input)

```bash
npm run run:local
```

### Clean build artifacts

```bash
npm run clean
```

## Input Schema

```typescript
interface WeeklyStatusInput {
  week: string;
  client: string;
  project: string;
  done: string[];
  doing: string[];
  next: string[];
  risks: {
    title: string;
    severity: "Low" | "Medium" | "High";
  }[];
  progress_override?: number | null;
}
```

## Business Logic

### Progress Calculation

- Uses `progress_override` if provided
- Otherwise: `Math.round((done.length / total.length) * 100)`

### Health Calculation

| Condition | Health |
|---|---|
| 2+ High risks | 🔴 Red |
| 1 High OR 2+ Medium | 🟡 Yellow |
| Otherwise | 🟢 Green |

## LLM Behavior

The LLM is constrained to normalization only:

- Shorten descriptions to executive-friendly single lines
- Remove technical noise (URLs, ticket numbers, jargon)
- Validate severity values
- Return structured JSON

The LLM does **not** generate Mermaid, markdown, or explanations.

## Output

The agent returns a Mermaid `flowchart TB` string ready for rendering in presentations, documentation, or dashboards.

## Requirements

- Node.js 18+
- GitHub Copilot CLI access
- Valid GitHub Copilot subscription
