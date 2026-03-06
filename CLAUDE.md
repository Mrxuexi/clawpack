# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ClawPack?

ClawPack is an application-layer packaging and distribution CLI for OpenClaw agents. It packages an agent's workspace, config, state, and credentials into a portable `.clawpack` archive (gzipped tar containing `manifest.json`, `config/`, `workspace/`, `state/`, `reports/`).

## Commands

```bash
npm run build          # compile TypeScript (tsc)
npm test               # run all tests (vitest run)
npm run test:watch     # run tests in watch mode
npx vitest run test/e2e.test.ts              # run a single test file
npx vitest run -t "exports a template pack"  # run a single test by name
npm run dev            # tsc --watch
```

## Architecture

```
src/cli.ts               — entry point, registers four commands via commander
src/commands/
  inspect.ts             — scan and report on an OpenClaw instance
  export.ts              — export instance to .clawpack archive
  import.ts              — import .clawpack archive to target directory
  verify.ts              — post-import structural checks
src/core/
  scanner.ts             — detect OpenClaw instances, sensitive data detection (SENSITIVE_PATTERNS, detectSensitiveContent())
  packer.ts              — export/import logic, exclusion lists (TEMPLATE_EXCLUDES, ALWAYS_EXCLUDE)
  verifier.ts            — structural verification checks (VerifyCheck objects)
  types.ts               — shared types (PackType, RiskLevel, Manifest, etc.) and SCHEMA_VERSION constant
src/utils/
  output.ts              — text/json formatting helpers
```

Tests are in `test/e2e.test.ts` — a single file that tests the core modules directly (scanner, packer, verifier) using temp directories.

## Key Concepts

- **PackType**: `"template"` (excludes secrets, safe to share) vs `"instance"` (full migration, includes everything)
- **RiskLevel**: `"safe-share"` | `"internal-only"` | `"trusted-migration-only"`
- **State directory**: defaults to `~/.openclaw`, auto-detected from several known names

## Conventions

- TypeScript strict mode, ESM (`"type": "module"` in package.json, `Node16` module resolution)
- All commands support `-f text` (default) and `-f json` output
- Errors set `process.exitCode = 1` — never call `process.exit()`
- JSON output goes to stdout; human-readable errors go to stderr
- File paths use `node:path` and `node:fs` — no third-party fs utilities
- Archive handling uses the `tar` npm package
- Import paths in source use `.js` extensions (ESM convention)
