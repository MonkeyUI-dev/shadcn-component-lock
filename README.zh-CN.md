# shadcn-component-lock

> 告诉所有 coding agent:`components/ui/` 里哪些文件是 [shadcn/ui](https://ui.shadcn.com/docs/components) 原版组件 —— **不允许就地修改**。

> English version: [README.md](README.md)

## 为什么需要它

Vibe Coding agents(Cursor、GitHub Copilot、Codex、Claude Code、Cline、Roo、Windsurf……)非常喜欢直接改 `components/ui/` 里的文件。原因在于 shadcn/ui 是把源文件直接复制进项目的——agent 看到的只是一个本地文件,根本无从判断它来自 shadcn,自然会选择最直接的方式:就地修改。一旦它们就地修改了某个 shadcn 原版 primitive，这个改动会悄无声息地扩散到整个应用中所有依赖它的组件——你在不知情的情况下改变了全局 UI 行为，同时也让后续的干净升级变得不可能。本 skill 会把一份 lockfile 放在 **primitives 旁边**,任何 agent 列出该目录时,第一眼就能看到 "禁止就地修改" 的提示。

它与官方 [`shadcn` skill](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) 配合:官方负责 **添加 / 更新** 组件,本 skill 负责 **记录 / 锁定** 组件。

## 快速开始

安装 skill(一个文件夹加一个 `SKILL.md`,遵循 [agentskills.io](https://agentskills.io/specification) 规范):

```bash
git clone https://github.com/MonkeyUI-dev/shadcn-component-lock ~/.agents/skills/shadcn-component-lock
# 或
npx skills add MonkeyUI-dev/shadcn-component-lock
```

然后在项目里,直接对 agent 说任意一句:

- "生成 shadcn 组件锁定文件。"
- "我刚加了几个组件,刷新一下 shadcn lockfile。"
- "哪些 UI 组件是原版 shadcn?"

或直接跑脚本:

```bash
node /path/to/shadcn-component-lock/scripts/generate-lock.mjs
```

## 你会得到什么

两个文件,路径都通过 `npx shadcn@latest info --json` 自动探测,**绝不写死**:

```
<resolvedPaths.ui>/shadcn-component-lock.md   # 例如 components/ui/shadcn-component-lock.md
AGENTS.md                                     # 项目根,带一段托管区块
```

`AGENTS.md` 中的区块用 `<!-- shadcn-component-lock:pointer -->` 包裹,重跑只替换该块,不会动你已有的 agent 规则。

Lockfile 内容包括:

- 一段 YAML metadata(`style`、`base`、Tailwind 版本、icon library……),直接读取自 `npx shadcn@latest info --json`。
- 一条便于 grep 的 `MUST NOT be edited in place` 横幅,提醒 coding agents。
- 一张表格,列出每个被锁定的 primitive 文件路径以及对应官方文档链接。
- 一段 "如何安全修改 primitive" 的速查表(wrapper → variant → smart-merge)。

详细 schema 见 [references/LOCK_FORMAT.md](references/LOCK_FORMAT.md)。

## CLI 参数

| Flag | 用途 |
| ---- | ---- |
| `--out PATH` | 自定义 lockfile 输出路径(默认 `<resolvedPaths.ui>/shadcn-component-lock.md`)。 |
| `--cwd DIR` | 针对其他项目目录运行。 |
| `--runner npx\|pnpm\|bun` | 选择调用 `shadcn@latest` 的包运行器。 |
| `--check` | lockfile 已过期时非零退出,适合接入 CI。 |
| `--dry-run` | 只打印到 stdout,不写文件。 |
| `--no-agents` | 跳过 `AGENTS.md` 更新。 |

## 何时运行

- **被动触发** —— 在你跑完 `npx shadcn@latest add/init/apply` 后,skill 会自动激活并刷新 lockfile。
- **主动触发** —— 任何时候说 "regenerate the shadcn lock",skill 都会重跑。
- **CI** —— 在流水线里加上 `node scripts/generate-lock.mjs --check`,lockfile 漂移时构建失败。

## 与官方 shadcn skill 的分工

| 关注点 | 由谁负责 |
| ------ | -------- |
| 探测项目上下文(`info --json`) | 官方 [`shadcn`](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) |
| 添加 / 更新 / 智能合并组件(`add`、`--diff`) | 官方 `shadcn` |
| 记录哪些文件是原版 primitive | **本 skill** |
| 提醒其他 agent 不要修改它们 | **本 skill**(通过 lockfile) |

本 skill 永远不会重复官方 skill 已经负责的 CLI 调用,统一走 `npx shadcn@latest info --json`。

## 反馈

这是一个 MVP —— 现阶段最有价值的就是真实使用反馈。欢迎 [提 issue](https://github.com/MonkeyUI-dev/shadcn-component-lock/issues/new) 报告 bug、缺失的参数或我们没覆盖到的工作流。

## License

MIT.
