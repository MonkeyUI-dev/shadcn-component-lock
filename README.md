# shadcn-component-lock

> Tell every coding agent which files in `components/ui/` are stock [shadcn/ui](https://ui.shadcn.com/docs/components) primitives — and must not be edited in place.

> 中文版:[README.zh-CN.md](README.zh-CN.md)

## Why

Vibe Coding agents (Cursor, GitHub Copilot, Codex, Claude Code, Cline, Roo, Windsurf…) love editing files in `components/ui/`. Because shadcn/ui copies source files directly into your repo, agents treat them as ordinary project code — they see a local file, have no way to know it came from shadcn, and reach for the quickest fix: edit it in place. The moment they patch a stock shadcn primitive in place, that change silently propagates through every component in your app that depends on it — you've just altered global UI behavior without realising it, and made clean upgrades impossible on top of that. This skill drops a lockfile **right next to the primitives** so any agent listing the folder sees the rule before it touches the code.

It pairs with the official [`shadcn` skill](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn): that one **adds & updates** components, this one **records & locks** them.

## Quick start

Install the skill (folder + `SKILL.md`, per the [agentskills.io](https://agentskills.io/specification) spec):

```bash
git clone https://github.com/MonkeyUI-dev/shadcn-component-lock ~/.agents/skills/shadcn-component-lock
# or
npx skills add MonkeyUI-dev/shadcn-component-lock
```

Then, from your project, just say:

- "Generate the shadcn component lock."
- "Refresh the shadcn lockfile — I just added a few components."
- "Which UI components are stock shadcn?"

Or run the script directly:

```bash
node /path/to/shadcn-component-lock/scripts/generate-lock.mjs
```

## What you get

Two files, both auto-located via `npx shadcn@latest info --json` (never hardcoded):

```
<resolvedPaths.ui>/shadcn-component-lock.md   # e.g. components/ui/shadcn-component-lock.md
AGENTS.md or CLAUDE.md                        # project root, with a managed section
```

The agent-rules target is auto-detected: any of `AGENTS.md` / `CLAUDE.md` that already exist at the project root get the managed section (both are updated when both are present). If neither exists, `AGENTS.md` is created as the default. The block is wrapped in `<!-- shadcn-component-lock:pointer -->`, so re-runs replace just that section and never touch the rest of your agent rules.

The lockfile contains:

- A YAML metadata block (`style`, `base`, Tailwind version, icon library…) read straight from `npx shadcn@latest info --json`.
- A grep-friendly `MUST NOT be edited in place` banner addressed to coding agents.
- A table of every locked primitive with file path + link to the official doc page.
- A short "how to change a primitive safely" cheatsheet (wrapper → variant → smart-merge).

Exact schema: [references/LOCK_FORMAT.md](references/LOCK_FORMAT.md).

## CLI flags

| Flag | Purpose |
| ---- | ------- |
| `--out PATH` | Write the lockfile to a custom path (default: `<resolvedPaths.ui>/shadcn-component-lock.md`). |
| `--cwd DIR` | Run against a different project directory. |
| `--runner npx\|pnpm\|bun` | Pick the package runner used to call `shadcn@latest`. |
| `--check` | Exit non-zero if the lockfile is stale. Wire this into CI. |
| `--dry-run` | Print the file to stdout instead of writing. |
| `--no-agents` | Skip the agent-rules file update entirely. |
| `--agents-file PATH` | Write the pointer to a specific file (repeat the flag for multiple targets). Overrides auto-detection. |

## When it runs

- **Passive** — activates automatically after `npx shadcn@latest add/init/apply` and refreshes the lockfile.
- **Active** — say "regenerate the shadcn lock" any time and the skill re-runs.
- **CI** — add `node scripts/generate-lock.mjs --check` to your pipeline to fail builds when the lock has drifted.

## How it coordinates with the official shadcn skill

| Concern | Skill |
| ------- | ----- |
| Discover project context (`info --json`) | official [`shadcn`](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) |
| Add / update / smart-merge components (`add`, `--diff`) | official `shadcn` |
| Record which files are stock primitives | **this skill** |
| Tell other agents not to edit them | **this skill** (via the lockfile) |

This skill never duplicates a CLI call the official skill already owns — it always goes through `npx shadcn@latest info --json`.

## Feedback

This is an MVP — real-world usage reports are the most valuable thing right now. Please [open an issue](https://github.com/MonkeyUI-dev/shadcn-component-lock/issues/new) for bugs, missing flags, or workflows we haven't covered.

## License

MIT.
