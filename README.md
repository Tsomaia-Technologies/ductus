# Ductus

> Agent-to-agent coordination orchestrator for autonomous task execution.

Ductus turns a high-level plan into actionable engineering tasks and executes them using AI agents—Architect decomposes the plan, Engineer implements each task, and Reviewer validates the work. Tasks are run sequentially; rejected implementations are retried with focused remediation until approved or max retries are reached.

## Prerequisites

- **Node.js** 18+
- **Cursor** with the `agent` CLI available in your PATH
- **Git** — the run flow requires a git repository (used to compute diffs for review)

## Installation

```bash
npm install -g @tsomaiatech/ductus
```

## Quick Start

1. **Eject prompts** (syncs prompt templates into your project):

   ```bash
   ductus eject
   ```

2. **Write a plan** — a markdown or text file describing what you want built (e.g. `plan.md`).

3. **Run**:

   ```bash
   ductus run my-feature --plan plan.md
   ```

## Commands

### `ductus eject [--overwrite]`

Copies prompt templates from the package into `.ductus/prompts/` in your project.

- **Without `--overwrite`**: Only adds missing prompts; does not touch existing files.
- **With `--overwrite`**: Replaces all prompts with the package defaults.

Run this once before your first `ductus run`, or when you want to pull updated prompts from the package.

### `ductus run <feature> --plan <path> [--max-retries <n>]`

Runs the full pipeline: plan → tasks → implement → review.

| Option | Description |
|--------|-------------|
| `feature` | Feature name (e.g. `auth-flow`). Used for the output folder `.ductus/<feature>/`. |
| `--plan <path>` | Path to the plan file. |
| `--max-retries <n>` | Max retries per task when the Reviewer rejects (default: 2). |

## How It Works

```
Plan (markdown) → Architect → Tasks (JSON)
                                    ↓
                    ┌───────────────┴───────────────┐
                    │  For each task:                │
                    │  1. Engineer implements       │
                    │  2. Reviewer checks diff     │
                    │  3. Approved? → next task     │
                    │     Rejected? → Remediation   │
                    │       Engineer retries        │
                    └───────────────────────────────┘
```

1. **Architect** — Reads the plan and decomposes it into structured tasks (id, summary, description, requirements, constraints). Output is validated against a JSON schema.
2. **Implementation Engineer** — Implements the task by editing files. Focuses on surrounding context, not the full codebase.
3. **Reviewer** — Reviews the git diff against the task, runs relevant checks (tests, linter, etc.), and outputs approval or rejection with feedback.
4. **Remediation Engineer** — When the Reviewer rejects, fixes only the reported issues using the rejection feedback and the previous diff.

Tasks and metadata are stored in `.ductus/<feature>/tasks.json`.

## Customizing Prompts

After running `ductus eject`, prompts live in `.ductus/prompts/`:

```
.ductus/prompts/
├── architect/         # Plan → tasks decomposition
├── implementation-engineer/
├── remediation-engineer/
└── reviewer/
```

Edit the `.mx` files there to tailor behavior. They use [Moxite](https://github.com/Tsomaia-Technologies/moxite) for templating. To reset to package defaults, run `ductus eject --overwrite`.

## License

MIT
