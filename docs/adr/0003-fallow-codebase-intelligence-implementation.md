# Fallow Codebase Intelligence — Implementation Plan

Companion to [ADR-0003](0003-fallow-codebase-intelligence.md).

## Context

The codebase has no static analysis beyond ESLint and TypeScript's compiler. Dead exports, unused files, duplicated logic, and complexity hotspots accumulate silently. Fallow is a Rust-native analysis engine for TS/JS that detects these categories deterministically (no AI internally). ADR-0003 decided to install it as a pinned dev dependency, wire it into CI via `fallow audit`, expose it to Claude Code via its MCP server, and provide npm scripts for local use.

This plan covers every file change needed to implement that decision.

## Open Questions

These should be resolved during implementation by running the tool and inspecting its output:

1. **MCP binary name.** The ADR says `fallow-mcp` at `./node_modules/.bin/fallow-mcp`. Fallow's docs describe a "version-matched Agent Skill" that ships with the npm package. After install, verify the exact binary name with `ls ./node_modules/.bin/fallow*`.

2. **`fallow init` generated config.** Running `fallow init` scaffolds `.fallowrc.json` with framework detection (it should detect Next.js). Inspect the generated file before customizing — it may already exclude common generated paths or set sensible defaults.

3. **pnpm `allowBuilds`.** Fallow is a Rust binary distributed via npm (postinstall binary download). If the install is blocked by pnpm, add `fallow: true` to `allowBuilds` in `pnpm-workspace.yaml`. Watch install output for warnings.

4. **`fallow audit` base ref behavior.** The docs say `--base` auto-detects the default branch if omitted. In the GitHub Actions PR context the base SHA is available. The plan uses explicit `--base` for clarity but this may be unnecessary.

## Implementation Steps

### 1. Install Fallow

```bash
npm install --save-dev fallow
```

After install, verify:
```bash
npx fallow --version
ls ./node_modules/.bin/fallow*
```

The second command reveals the exact binaries installed (expected: `fallow`, `fallow-mcp` or similar).

If pnpm blocks the postinstall binary download, add to `pnpm-workspace.yaml`:
```yaml
allowBuilds:
  sharp: true
  unrs-resolver: true
  msw: false
  fallow: true
```

### 2. Generate and configure `.fallowrc.json`

Run `fallow init` to scaffold the config with Next.js detection:
```bash
npx fallow init
```

Then customize the generated file to match the ADR decisions:

```jsonc
{
  "$schema": "https://fallow.tools/schema.json",
  "ignorePatterns": [
    "src/components/ui/**"
  ],
  "rules": {
    "unused-files": "error",
    "unused-exports": "warn",
    "unused-types": "warn",
    "unused-dependencies": "error",
    "unused-dev-dependencies": "warn",
    "circular-dependencies": "warn",
    "unresolved-imports": "error",
    "unlisted-dependencies": "error"
  }
}
```

**Severity rationale:**
- `error`: unused-files, unused-dependencies, unresolved-imports, unlisted-dependencies — high signal, low noise
- `warn`: unused-exports, unused-types, unused-dev-dependencies, circular-dependencies — noisier in Next.js (re-exports, barrel files), start lenient and promote after triage

After writing, verify the exclusion works: `npx fallow dead-code` output should contain zero files from `src/components/ui/`.

### 3. Add `.fallow/` to `.gitignore`

`fallow init` may do this automatically. If not, add after the `.claude/` line:

```gitignore
# fallow cache
.fallow/
```

Fallow stores cache, baselines, and snapshots in `.fallow/` — machine-local, not committed.

### 4. Add npm scripts to `package.json`

Add to the `scripts` object:

```json
"fallow": "fallow dead-code && fallow dupes && fallow health",
"fallow:dead-code": "fallow dead-code",
"fallow:dupes": "fallow dupes",
"fallow:health": "fallow health",
"fallow:fix": "fallow fix --dry-run",
"fallow:audit": "fallow audit"
```

`npm run fallow` chains all three analyses sequentially. `fallow:fix` defaults to `--dry-run` for safety.

### 5. Un-ignore `.claude/settings.json` in `.gitignore`

The `.claude/` directory is fully ignored (line 39). The MCP config needs to be committed so it's shared.

Change:
```gitignore
# claude code local settings
.claude/
```

To:
```gitignore
# claude code local settings
.claude/
!.claude/settings.json
```

Verify with `git check-ignore -v .claude/settings.json` — should report "not ignored".

### 6. Create `.claude/settings.json`

**New file:** `.claude/settings.json`

```json
{
  "mcpServers": {
    "fallow": {
      "command": "./node_modules/.bin/fallow-mcp"
    }
  }
}
```

**To verify during implementation:** After install, confirm the actual MCP binary name from `ls ./node_modules/.bin/fallow*`. If the binary name differs, adjust accordingly. On Windows, the `.bin` directory has both shell scripts and `.cmd` wrappers — Node's stdio transport should resolve either, but test with `npx fallow-mcp --help` first.

### 7. Add `fallow audit` to CI

**Modify:** `.github/workflows/ci.yml`

Two changes to the `test` job:

**a)** Add `fetch-depth: 0` to the Checkout step (Fallow needs git history to diff against the base branch):

```yaml
- name: Checkout
  uses: actions/checkout@v5
  with:
    fetch-depth: 0
```

**b)** Add a new step after "Run tests":

```yaml
- name: Fallow audit
  if: github.event_name == 'pull_request'
  run: npx fallow audit --base origin/${{ github.event.pull_request.base.ref }}
```

**Why in the existing job, not a new one?** Avoids duplicating checkout + install. The audit step is fast (sub-second for typical PRs) and benefits from already-installed `node_modules`.

**Why `fetch-depth: 0`?** The default shallow clone doesn't have the base branch ref. Full history is the simplest fix. If this noticeably slows checkout, switch to `fetch-depth: 2` or a targeted `git fetch`.

**Why `if: pull_request`?** `fallow audit` needs a base ref to diff against. On non-PR events there's no meaningful base.

### 8. Run initial baseline analysis (manual, not automated)

After all config is in place, run locally:

```bash
npm run fallow
```

Triage the output:
- **Legitimate dead code:** remove before the first PR, so the CI gate starts clean
- **False positives in generated files:** confirm `ignorePatterns` excludes them
- **Warnings to address later:** leave as warnings — they won't block CI

## Implementation Order

```
Step 1  — Install fallow (independent)
Step 2  — fallow init + configure (depends on 1)
Step 3  — .gitignore: .fallow/ (depends on 2, may be automatic)
Step 4  — npm scripts (depends on 1)
Step 5  — .gitignore: un-ignore .claude/settings.json (independent)
Step 6  — .claude/settings.json (depends on 1, 5)
Step 7  — CI workflow (depends on 1, 2)
Step 8  — Baseline triage (depends on 1-4, manual)
```

Steps 1–7 can be a single commit. Step 8 may produce follow-up commits (dead code removal).

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `package.json` | Modify | Add `fallow` devDependency + 6 npm scripts |
| `package-lock.json` | Auto | Lockfile update |
| `.fallowrc.json` | New | Fallow config: ignorePatterns, rules, severity |
| `.gitignore` | Modify | Add `.fallow/`, un-ignore `.claude/settings.json` |
| `.claude/settings.json` | New | MCP server config for fallow-mcp |
| `.github/workflows/ci.yml` | Modify | fetch-depth: 0, add Fallow audit step |
| `pnpm-workspace.yaml` | Maybe | Add fallow to allowBuilds if needed |

## Verification

1. `npm run fallow` completes and produces output for all three analyses
2. `npm run fallow:dead-code` output contains zero files from `src/components/ui/`
3. `npm run fallow:audit` runs locally and produces a pass/warn/fail verdict
4. Claude Code session shows the fallow MCP server in available tools and can invoke analysis queries
5. `git check-ignore -v .claude/settings.json` reports "not ignored"
6. Open a PR with these changes — "Fallow audit" CI step runs and passes
7. Existing Lint, Test, and Docker Build CI steps remain green
