# ClawPack

ClawPack is an application-layer packaging and distribution tool for [OpenClaw](https://github.com/openclaw/openclaw) agents.

It solves a simple problem: standardized export, import, and verification of a tuned OpenClaw Agent. It's not a container or a VM — it's an application-level distribution package built on top of those infrastructures.

## Why

An OpenClaw agent's usable state is more than just code or config. It includes:

- Workspace (AGENTS.md, SOUL.md, TOOLS.md, skills, etc.)
- Provider configuration
- Channel configuration
- State / memory
- Credentials and runtime info

Docker can distribute the runtime environment, but it can't express "which parts are templates, which are state, and which need rebinding." ClawPack fills that gap.

## Install

```bash
npm install -g clawpack
```

Requires Node.js >= 20.

## Quick Start

```bash
# 1. Inspect an OpenClaw instance
clawpack inspect

# 2. Export as a template pack (safe to share)
clawpack export -t template -o my-agent.clawpack

# 3. Import on another machine
clawpack import my-agent.clawpack -t ~/.openclaw

# 4. Verify the import
clawpack verify
```

## Commands

### `clawpack inspect`

Scan an OpenClaw instance, report its structure, sensitive data, and recommended export type.

```bash
clawpack inspect                  # auto-detect ~/.openclaw
clawpack inspect -p /path/to/dir  # custom path
clawpack inspect -f json          # JSON output
```

### `clawpack export`

Export an instance as a `.clawpack` package.

```bash
clawpack export -t template       # template pack (excludes secrets)
clawpack export -t instance       # instance pack (full migration)
clawpack export -o out.clawpack   # custom output path
clawpack export -p /path/to/dir   # custom source path
```

### `clawpack import`

Import a `.clawpack` package into a target environment.

```bash
clawpack import my-agent.clawpack              # restore to ~/.openclaw
clawpack import my-agent.clawpack -t ./target  # custom target
```

### `clawpack verify`

Verify an imported instance is structurally complete and usable.

```bash
clawpack verify                  # verify ~/.openclaw
clawpack verify -p /path/to/dir  # custom path
```

## Package Types

| Type | Use Case | Includes | Risk Level |
|------|----------|----------|------------|
| **template** | Share & reuse | Workspace, non-sensitive config | `safe-share` |
| **instance** | Full migration | Config, workspace, state, credentials | `trusted-migration-only` |

Template packs automatically exclude credentials, sessions, memory databases, and `.env` files.

## Package Format

A `.clawpack` file is a gzipped tar archive containing:

```
manifest.json       # Pack metadata (schema version, type, risk level, etc.)
config/             # Configuration files
workspace/          # Agent workspace (AGENTS.md, SOUL.md, skills, etc.)
state/              # Session and credential data (instance packs only)
reports/            # Export report
```

## Risk Levels

| Level | Description |
|-------|-------------|
| `safe-share` | No sensitive data, safe to distribute |
| `internal-only` | May contain non-critical config, share within team |
| `trusted-migration-only` | Contains credentials/state, trusted environments only |

## Output Formats

All commands support `-f text` (default, human-readable) and `-f json` (machine-readable).

```bash
clawpack inspect -f json | jq '.riskAssessment'
```

## Development

```bash
git clone https://github.com/anthropics/clawpack.git
cd clawpack
npm install
npm run build
npm test
```

## License

MIT
