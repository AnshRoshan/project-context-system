# Install

The skill is three things you can install independently:

1. **The skill** — `SKILL.md` + `references/` + `assets/`, so an agent knows the method.
2. **The CLI** — `scripts/ctx.mjs`, zero dependencies, Node ≥ 18.
3. **The scaffold** — what the CLI writes into *your* project (AGENTS.md, `context/`, hooks).

## 1. The skill

Claude Code (personal):

```bash
cp -r project-context-system ~/.claude/skills/
```

Qoder CLI (personal):

```bash
cp -r project-context-system ~/.qoder/skills/
```

Project-level (any tool that reads `skills/*/SKILL.md`):

```bash
cp -r project-context-system /path/to/your-project/.claude/skills/
```

As a plugin (bundles the skill and keeps it updatable):

```bash
/plugin marketplace add AnshRoshan/project-context-system
/plugin install project-context-system
```

## 2. The CLI

Run it straight from the skill — no install step, no dependencies:

```bash
node /path/to/project-context-system/scripts/ctx.mjs --help
```

Or put it on your PATH by copying it somewhere in it and marking it executable:

```bash
install -m 755 /path/to/project-context-system/scripts/ctx.mjs ~/.local/bin/ctx
ctx --help
```

## 3. The scaffold

Run `init` **from the skill directory** — it is the one command that reads `assets/`:

```bash
node /path/to/project-context-system/scripts/ctx.mjs init --root /path/to/your-project
```

Flags: none needed — `init` detects the project profile (languages, kinds, UI/DB/API signals,
installed agent tools) and scaffolds what fits. Overrides: `--ui`/`--no-ui`, `--full`,
`--pointers` (all tool pointer files), `--no-detect`. Preview the decision with
`node scripts/ctx.mjs detect --root <project>` (run from inside the project for detection).

`init` copies the CLI into `context/ctx.mjs`, so the project carries its own tooling
afterwards and every later command is simply:

```bash
node context/ctx.mjs brief src/whatever.ts
```

`init` never overwrites an existing file, so it is safe to re-run.

## Verify the install

```bash
node context/ctx.mjs doctor
```

17 checks covering the things that quietly break: that `CLAUDE.md` really imports
`AGENTS.md`, that git actually ignores `context/current-issues.md` and `.env`, that
`.claude/settings.json` denies `.env*` reads and has both hooks, and that the
always-read context fits in its token budget. Exits non-zero when anything fails.

A green `doctor` plus `ctx lint` is the definition of a correctly wired project.

## Test the tool itself

```bash
node tests/run.mjs          # or: npm test
```

37 end-to-end cases against throwaway git repos. If you change `scripts/ctx.mjs`,
run it. It needs no dependencies and no network.

## Uninstall

Remove the skill directory. Inside a project that was scaffolded, delete what you
want to stop maintaining — there is no registry, no daemon, no hidden state:

```bash
rm -rf context/ AGENTS.md CLAUDE.md CLAUDE.local.md memory.md
```

The `.gitignore` entries added by `init` are marked `# project-context-system` and
are safe to delete by hand. Removing the plugin does not touch projects already
scaffolded; that is deliberate — your project's wiki is yours, not the skill's.

## Requirements

- **Node ≥ 18** for the CLI. The skill itself (the markdown) has no requirements.
- **git** is optional but recommended: without it `ctx stale` and `ctx impact`
  degrade to no-ops and `doctor` reports it.
- Works with Claude Code, Codex, Cursor, Copilot, Gemini CLI, Qoder, Zed and anything
  else that reads `AGENTS.md`.
