#!/usr/bin/env node
// Generate shadcn-component-lock.md inside the project's shadcn UI directory.
//
// Strategy:
//   1. Ask the official shadcn CLI for project context (`npx shadcn@latest info --json`).
//   2. List files in `resolvedPaths.ui`.
//   3. Render the lockfile from assets/lock-template.md and write it INSIDE that ui dir.
//   4. Append a one-line pointer to AGENTS.md (created if missing) so other agents find it.
//
// Usage:
//   node scripts/generate-lock.mjs                # writes <ui-dir>/shadcn-component-lock.md
//   node scripts/generate-lock.mjs --out PATH     # writes to PATH instead
//   node scripts/generate-lock.mjs --cwd DIR      # run against another project
//   node scripts/generate-lock.mjs --runner pnpm  # use `pnpm dlx shadcn@latest`
//   node scripts/generate-lock.mjs --check        # exit 1 if lockfile is stale
//   node scripts/generate-lock.mjs --dry-run      # print to stdout, do not write
//   node scripts/generate-lock.mjs --no-agents    # skip updating AGENTS.md

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative, resolve, basename, extname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const TEMPLATE_PATH = join(SKILL_ROOT, "assets", "lock-template.md");
const SKILL_VERSION = "0.1.0";
const DOCS_BASE = "https://ui.shadcn.com/docs/components";
const LOCK_FILENAME = "shadcn-component-lock.md";
const AGENTS_MARKER = "<!-- shadcn-component-lock:pointer -->";

function parseArgs(argv) {
  const args = { out: null, cwd: process.cwd(), runner: "npx", check: false, dryRun: false, agents: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") args.out = argv[++i];
    else if (a === "--cwd") args.cwd = resolve(argv[++i]);
    else if (a === "--runner") args.runner = argv[++i];
    else if (a === "--check") args.check = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--no-agents") args.agents = false;
    else if (a === "-h" || a === "--help") {
      console.log("Usage: node generate-lock.mjs [--out PATH] [--cwd DIR] [--runner npx|pnpm|bun] [--check] [--dry-run] [--no-agents]");
      process.exit(0);
    }
  }
  return args;
}

function runShadcnInfo({ runner, cwd }) {
  const cmd = runner === "pnpm" ? ["pnpm", ["dlx", "shadcn@latest", "info", "--json"]]
            : runner === "bun"  ? ["bunx",  ["--bun", "shadcn@latest", "info", "--json"]]
            :                     ["npx",   ["shadcn@latest", "info", "--json"]];
  try {
    const out = execFileSync(cmd[0], cmd[1], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON in CLI output");
    return normalizeCtx(JSON.parse(out.slice(start, end + 1)));
  } catch (err) {
    console.error("[shadcn-component-lock] `shadcn info --json` failed:", err.message);
    return null;
  }
}

// shadcn 4.x nests config under `config` and project metadata under `project`.
// shadcn 3.x exposed everything at the top level. Flatten to the 3.x shape so the
// rest of the script stays version-agnostic.
function normalizeCtx(raw) {
  if (!raw || typeof raw !== "object") return raw;
  const cfg = raw.config && typeof raw.config === "object" ? raw.config : {};
  const project = raw.project && typeof raw.project === "object" ? raw.project : {};
  return {
    ...raw,
    resolvedPaths: raw.resolvedPaths ?? cfg.resolvedPaths ?? {},
    aliases: raw.aliases ?? cfg.aliases ?? {},
    style: raw.style ?? cfg.style ?? null,
    base: raw.base ?? cfg.base ?? null,
    iconLibrary: raw.iconLibrary ?? cfg.iconLibrary ?? null,
    tailwindVersion: raw.tailwindVersion ?? project.tailwindVersion ?? cfg.tailwindVersion ?? null,
    components: raw.components ?? cfg.components ?? null,
  };
}

function fallbackContext(cwd) {
  // Last-resort: read components.json by hand. The official skill's contract is the source
  // of truth, so we only do this when the CLI is unavailable (offline / older shadcn).
  const cfgPath = join(cwd, "components.json");
  if (!existsSync(cfgPath)) return null;
  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
  const uiAlias = cfg?.aliases?.ui ?? "@/components/ui";
  // Best-effort guess for the on-disk path: drop common alias prefixes, then try
  // common roots (./, ./src/, ./app/) until one of them actually exists.
  const stripped = uiAlias.replace(/^@\//, "").replace(/^~\//, "").replace(/^@[^/]+\//, "");
  const candidates = [stripped, `src/${stripped}`, `app/${stripped}`];
  const uiPath = candidates.map((c) => join(cwd, c)).find((p) => existsSync(p)) ?? join(cwd, stripped);
  return {
    resolvedPaths: { ui: uiPath },
    aliases: cfg.aliases ?? {},
    style: cfg.style ?? null,
    base: cfg.base ?? (cfg.radix ? "radix" : null),
    tailwindVersion: null,
    iconLibrary: cfg.iconLibrary ?? null,
    components: null,
    _fallback: true,
  };
}

function listUiFiles(uiPath) {
  if (!uiPath || !existsSync(uiPath)) return [];
  return readdirSync(uiPath)
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .filter((f) => statSync(join(uiPath, f)).isFile())
    .sort();
}

function componentNameFromFile(file) {
  return basename(file, extname(file));
}

function render({ ctx, files, cwd, outPath, fallbackUsed }) {
  const tpl = readFileSync(TEMPLATE_PATH, "utf8");
  const uiPathRel = (relative(cwd, ctx.resolvedPaths?.ui ?? "") || ".").split("\\").join("/");
  const outDir = dirname(outPath);
  const componentSet = new Set(
    (ctx.components ?? files.map(componentNameFromFile)).map((c) =>
      typeof c === "string" ? c : c.name ?? c
    )
  );

  const rows = files.map((f) => {
    const name = componentNameFromFile(f);
    const tracked = componentSet.has(name);
    // File link is relative to the lockfile's own directory so the markdown link resolves.
    const linkPath = (relative(outDir, join(ctx.resolvedPaths.ui, f)).split("\\").join("/")) || f;
    const docs = `${DOCS_BASE}/${name}`;
    const marker = tracked ? "🔒" : "❓";
    return `| ${marker} | \`${name}\` | [\`${linkPath}\`](${linkPath}) | [docs](${docs}) |`;
  });

  const meta = [
    `style: ${ctx.style ?? "unknown"}`,
    `base: ${ctx.base ?? "unknown"}`,
    `tailwind: ${ctx.tailwindVersion ?? "unknown"}`,
    `iconLibrary: ${ctx.iconLibrary ?? "unknown"}`,
    `aliases.ui: ${ctx.aliases?.ui ?? "unknown"}`,
    `lockfile: ${(relative(cwd, outPath) || LOCK_FILENAME).split("\\").join("/")}`,
    `generator: shadcn-component-lock@${SKILL_VERSION}`,
    `generatedAt: ${new Date().toISOString()}`,
    fallbackUsed ? "source: components.json (fallback — shadcn CLI unavailable)" : "source: npx shadcn@latest info --json",
  ].join("\n");

  return tpl
    .replace("{{META_BLOCK}}", meta)
    .replace(/\{\{UI_DIR\}\}/g, uiPathRel)
    .replace("{{COMPONENT_TABLE}}", rows.length ? rows.join("\n") : "_(no shadcn components found)_")
    .replace("{{COUNT}}", String(rows.length));
}

function updateAgentsFile({ cwd, outPath, uiPathRel }) {
  const agentsPath = join(cwd, "AGENTS.md");
  const lockRel = (relative(cwd, outPath) || LOCK_FILENAME).split("\\").join("/");
  const block = [
    "",
    "## shadcn primitives are locked",
    "",
    AGENTS_MARKER,
    "",
    `The files under \`${uiPathRel}/\` are stock [shadcn/ui](https://ui.shadcn.com/docs/components) primitives, reused across the project.`,
    `**Do NOT edit them in place.** Read [\`${lockRel}\`](${lockRel}) for the full list and the safe ways to change a primitive`,
    "(wrapper component → `cva` variant → `npx shadcn@latest add <component> --diff` smart-merge).",
    "",
    "_This section is maintained by the [`shadcn-component-lock`](https://agentskills.io/) skill — re-run `node scripts/generate-lock.mjs` to refresh._",
    "",
  ].join("\n");

  if (!existsSync(agentsPath)) {
    const header = `# AGENTS.md\n\nGuidance for AI coding agents working in this repository.\n`;
    writeFileSync(agentsPath, header + block);
    return { path: agentsPath, action: "created" };
  }

  const current = readFileSync(agentsPath, "utf8");
  if (current.includes(AGENTS_MARKER)) {
    // Replace the existing managed section so the lockfile path / ui dir stay in sync.
    const re = /\n## shadcn primitives are locked[\s\S]*?_This section is maintained by the \[`shadcn-component-lock`\][^\n]*_\n/m;
    if (re.test(current)) {
      writeFileSync(agentsPath, current.replace(re, block));
      return { path: agentsPath, action: "updated" };
    }
    writeFileSync(agentsPath, current.trimEnd() + "\n" + block);
    return { path: agentsPath, action: "updated" };
  }

  writeFileSync(agentsPath, current.trimEnd() + "\n" + block);
  return { path: agentsPath, action: "appended" };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cwd = args.cwd;

  let ctx = runShadcnInfo({ runner: args.runner, cwd });
  let fallbackUsed = false;
  if (!ctx) {
    ctx = fallbackContext(cwd);
    fallbackUsed = true;
  }
  if (!ctx) {
    console.error("[shadcn-component-lock] No shadcn project detected (no components.json, CLI failed). Aborting.");
    process.exit(2);
  }

  const uiPath = ctx.resolvedPaths?.ui;
  if (!uiPath || !existsSync(uiPath)) {
    console.error(`[shadcn-component-lock] shadcn UI directory not found: ${uiPath ?? "<unresolved>"}`);
    process.exit(2);
  }

  const files = listUiFiles(uiPath);
  // Default lockfile location: INSIDE the shadcn ui directory (next to the primitives).
  const outPath = resolve(cwd, args.out ?? join(uiPath, LOCK_FILENAME));
  const out = render({ ctx, files, cwd, outPath, fallbackUsed });

  if (args.dryRun) {
    process.stdout.write(out);
    return;
  }

  if (args.check) {
    const existing = existsSync(outPath) ? readFileSync(outPath, "utf8") : "";
    const norm = (s) => s.replace(/^generatedAt: .*$/m, "generatedAt: <ignored>");
    if (norm(existing) === norm(out)) {
      console.log(`[shadcn-component-lock] up-to-date (${files.length} components)`);
      process.exit(0);
    } else {
      console.error(`[shadcn-component-lock] STALE — re-run without --check to update ${relative(cwd, outPath)}`);
      process.exit(1);
    }
  }

  writeFileSync(outPath, out);
  console.log(`[shadcn-component-lock] wrote ${relative(cwd, outPath)} (${files.length} components${fallbackUsed ? ", fallback mode" : ""})`);

  if (args.agents) {
    const uiPathRel = (relative(cwd, uiPath) || ".").split("\\").join("/");
    const result = updateAgentsFile({ cwd, outPath, uiPathRel });
    console.log(`[shadcn-component-lock] ${result.action} ${relative(cwd, result.path)}`);
  }
}

main();
