# shadcn-component-lock

> 中文版:[README.zh-CN.md](README.zh-CN.md)

> An [Agent Skill](https://agentskills.io/) that generates and maintains a `shadcn-component-lock.md` file **inside your project's shadcn UI directory** — telling every Vibe Coding agent (Cursor, GitHub Copilot, Codex, Claude Code, Cline, Roo, Windsurf…) which sibling files are stock [shadcn/ui](https://ui.shadcn.com/docs/components) primitives and **must not be edited in place**. It also keeps a managed pointer section in your project's `AGENTS.md`.

It pairs with the official [`shadcn` skill](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn): that one **adds & updates** components, this one **records & locks** them.

## What it produces

Two files, both auto-located from `npx shadcn@latest info --json` (never hardcoded):

```
<resolvedPaths.ui>/shadcn-component-lock.md   # e.g. components/ui/shadcn-component-lock.md
AGENTS.md                                     # at the project root, with a managed section
```

The lockfile lives **next to the primitives it locks**, so any agent that lists `components/ui/` sees it immediately. The `AGENTS.md` section is delimited by `<!-- shadcn-component-lock:pointer -->`, so re-runs replace just that block and never touch the rest of your agent rules.

It contains:

- A YAML metadata block (`style`, `base`, tailwind version, icon library, …) read straight from `npx shadcn@latest info --json`.
- A grep-friendly `MUST NOT be edited in place` banner addressed to coding agents.
- A table of every locked primitive with file path + link to the official doc page.
- A short "how to change a primitive safely" cheatsheet (wrapper → variant → smart-merge).

See [references/LOCK_FORMAT.md](references/LOCK_FORMAT.md) for the exact schema.

## Install

This skill follows the [agentskills.io](https://agentskills.io/specification) spec — a folder with a `SKILL.md`. Drop it into wherever your agent looks for skills, for example:

```bash
# Claude Code / generic skills location
git clone https://github.com/MonkeyUI-dev/shadcn-component-lock ~/.agents/skills/shadcn-component-lock

# or via the skills CLI
npx skills add MonkeyUI-dev/shadcn-component-lock
```

## Use

Once installed, just say one of these to your agent:

- "Generate the shadcn component lock."
- "Refresh the shadcn lockfile — I just added a few components."
- "Which UI components are stock shadcn?"

…or run the script directly from your project root:

```bash
node /path/to/shadcn-component-lock/scripts/generate-lock.mjs
```

Useful flags:

| Flag | Purpose |
| ---- | ------- |
| `--out PATH` | Write the lockfile to a custom path (default: `<resolvedPaths.ui>/shadcn-component-lock.md`). |
| `--cwd DIR` | Run against a different project directory. |
| `--runner npx\|pnpm\|bun` | Pick the package runner used to call `shadcn@latest`. |
| `--check` | Exit non-zero if the lockfile is stale. Wire this into CI. |
| `--dry-run` | Print the file to stdout instead of writing. |
| `--no-agents` | Skip the `AGENTS.md` update. |

## Updates

- **Passive** — the skill activates automatically after `npx shadcn@latest add/init/apply` and refreshes the lockfile.
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

## License

MIT.