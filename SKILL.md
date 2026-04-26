---
name: shadcn-component-lock
description: Generates and maintains a `shadcn-component-lock.md` file at the project root that tells Vibe Coding agents which files in the shadcn UI directory are stock shadcn/ui primitives — reused across the project and NOT to be edited directly. Use this skill whenever the user runs `npx shadcn@latest add`, `init`, or `apply`; whenever new files appear under the project's shadcn `aliases.ui` directory; whenever the user asks to "lock", "freeze", "pin", "regenerate", "refresh", or "update" the shadcn component lockfile; or whenever a Vibe Coding agent (e.g. Cursor, Copilot, Codex, Claude Code) is about to modify a file under `components/ui` and needs to know whether it is safe to touch. Coordinates with the official `shadcn` skill from shadcn-ui/ui.
license: MIT
metadata:
  author: MonkeyUI-dev
  version: "0.1.0"
  homepage: https://github.com/MonkeyUI-dev/shadcn-component-lock
allowed-tools: Bash(npx shadcn@latest *) Bash(pnpm dlx shadcn@latest *) Bash(bunx --bun shadcn@latest *) Bash(node *) Read Write Edit
---

# shadcn-component-lock

This skill produces and maintains a single artifact, written **inside the project's shadcn UI directory** (i.e. `resolvedPaths.ui` from `shadcn info` — typically `components/ui/`):

```
<resolvedPaths.ui>/shadcn-component-lock.md
```

The location is auto-detected per project — never hardcoded — so it works equally well in flat repos (`components/ui/`), `src/`-based repos (`src/components/ui/`), and monorepos (`packages/ui/src/components/`).

It is a machine- and human-readable manifest of every **stock shadcn/ui** component currently installed in the project (sourced from <https://ui.shadcn.com/docs/components>), together with the rule:

> **These files are project-wide reusable primitives. Do NOT edit them in place.**
> If you need different behavior, create a wrapper, add a `cva` variant, or use the official `npx shadcn@latest add <component> --diff` smart-merge workflow.

The lockfile is what Vibe Coding agents (Cursor, GitHub Copilot, Codex, Claude Code, Cline, Roo, etc.) read to decide whether a file under `components/ui/` is safe to refactor.

---

## When to activate

Activate this skill when ANY of the following is true:

1. **Passive triggers** (something changed the UI directory)
   - The user just ran `npx shadcn@latest add ...`, `init`, `apply`, or `--overwrite`.
   - New files appear under `aliases.ui` (e.g. `components/ui/`) since the lockfile was last written.
   - `shadcn-component-lock.md` is missing in a project that has a `components.json`.
   - The official `shadcn` skill (shadcn-ui/ui) just finished adding/updating components.

2. **Active triggers** (developer intent)
   - User says "lock", "freeze", "pin", "regenerate", "refresh", "rebuild", or "update" the shadcn lockfile / component-lock.
   - User asks "which UI components are stock shadcn?" or "which files am I not supposed to touch?".
   - User asks to onboard a new agent / IDE to respect shadcn primitives.

3. **Defensive triggers** (an agent is about to do something risky)
   - A coding agent proposes editing a file inside `aliases.ui` — first read the lockfile and warn if listed.
   - A coding agent proposes "improving" or "refactoring" a stock primitive.

---

## Coordination with the official `shadcn` skill

The official skill at [shadcn-ui/ui/skills/shadcn](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) owns:

- Discovering project context via `npx shadcn@latest info --json`
- Adding / updating / diffing components via `npx shadcn@latest add`
- Smart-merge upstream changes (`--dry-run`, `--diff`)

This skill **builds on top of it** — it does not duplicate or replace any of its commands. The contract is:

| Step | Owner |
| ---- | ----- |
| Discover installed components, `resolvedPaths.ui`, `aliases.ui`, `style`, `base` | official `shadcn` skill (via `info --json`) |
| Add / update / merge components | official `shadcn` skill (via `add`) |
| Record which files are stock primitives & forbid in-place edits | **this skill** (writes `shadcn-component-lock.md`) |
| Remind other agents not to edit those files | **this skill** (the lockfile itself) |

If both skills are present, prefer running the official `shadcn` workflow first, then run this skill at the end of the workflow to refresh the lockfile.

---

## Workflow

### 1. Detect project context

Run the official CLI (do NOT parse `components.json` directly — let the CLI do it):

```bash
npx shadcn@latest info --json
```

From the JSON capture:

- `resolvedPaths.ui` — absolute path of the UI components directory
- `aliases.ui` — the import alias (e.g. `@/components/ui`)
- `components` — the list of installed component names (canonical shadcn names)
- `style`, `base`, `tailwindVersion`, `iconLibrary` — recorded into the lockfile header for context

If `npx shadcn@latest info --json` is not available (older CLI), fall back to listing files in `resolvedPaths.ui`.

### 2. Generate the lockfile

Run the bundled script:

```bash
node scripts/generate-lock.mjs
```

The script:

1. Calls `npx shadcn@latest info --json` from the project root.
2. Reads `resolvedPaths.ui` and lists its files.
3. Writes `shadcn-component-lock.md` **inside that UI directory**, using the layout in [assets/lock-template.md](assets/lock-template.md). File-path links in the table are emitted relative to the lockfile so they resolve from any viewer.
4. Maps each entry to its canonical doc URL `https://ui.shadcn.com/docs/components/<name>`.
5. Updates `AGENTS.md` at the project root (creates it if missing) with a short managed section pointing to the lockfile. The section is delimited by a hidden marker comment (`<!-- shadcn-component-lock:pointer -->`) so subsequent runs replace just that block and never clobber other agent rules.

If the developer prefers a different location, pass `--out <path>`:

```bash
node scripts/generate-lock.mjs --out shadcn-component-lock.md   # back to project root
```

To skip the AGENTS.md update, pass `--no-agents`.

### 3. Surface the rule to other agents

The script automatically maintains a `## shadcn primitives are locked` section in `AGENTS.md` at the project root (the de-facto standard manifest read by Cursor, Codex, Claude Code, Copilot, etc.). The section is wrapped by a hidden marker so re-runs replace just that block and leave the rest of `AGENTS.md` untouched. If `AGENTS.md` doesn't exist, the script creates it with a minimal header.

For projects that use additional convention files (`.cursorrules`, `.github/copilot-instructions.md`, `CLAUDE.md`, `.windsurfrules`), ask the developer if they want the same one-line pointer appended there too — never write into those without consent.

### 4. Passive refresh after `shadcn add`

When you observe `npx shadcn@latest add ...` finishing successfully (or are explicitly told the component list changed), re-run **step 2** and show the user a short diff of which components were added/removed in the lockfile. Do not re-prompt for the agent-rules pointer — that is a one-time setup.

### 5. Active refresh

If the user asks "regenerate / refresh / update the shadcn lock", re-run **step 2** unconditionally and report the diff.

---

## Detecting drift

Before regenerating, compare the current `shadcn-component-lock.md` against fresh CLI output:

- **New components installed** → add to lockfile.
- **Components removed from disk** → remove from lockfile.
- **A listed file has been edited locally** (detected via `npx shadcn@latest add <name> --diff`) → flag it in the lockfile under a `## Locally Modified` section, and warn the user that the file has diverged from upstream and may not be safe to overwrite. Do NOT silently relock a modified file — surface it to the user first.

---

## Output contract

The generated `shadcn-component-lock.md` MUST contain, in order:

1. A YAML-style metadata block (style, base, tailwind version, generator version, generated-at, **lockfile path relative to project root**).
2. A bold "DO NOT MODIFY" banner addressed to coding agents.
3. The list of locked component files, each with: file path (relative to the lockfile), canonical name, docs URL.
4. A short "How to change a primitive" section pointing to the official `shadcn` smart-merge flow.
5. (Optional) A "Locally Modified" section listing diverged files.

The AGENTS.md managed block MUST be delimited by `<!-- shadcn-component-lock:pointer -->` so it is idempotent and easy to detect.

See [references/LOCK_FORMAT.md](references/LOCK_FORMAT.md) for the exact schema and an example.

---

## Non-goals

- This skill does NOT install, update, or remove shadcn components — that is the official `shadcn` skill's job.
- This skill does NOT enforce the rule at commit-time (no git hooks). It only produces the manifest; enforcement happens in the agent's reading loop.
- This skill does NOT lock non-shadcn files. Anything outside `resolvedPaths.ui` is out of scope.
