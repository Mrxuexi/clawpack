# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2025-01-01

### Added

- `clawpack inspect` — scan an OpenClaw instance structure, detect sensitive data, recommend export type
- `clawpack export` — export an instance as a `.clawpack` package (template or instance mode)
- `clawpack import` — import a `.clawpack` package into a target directory
- `clawpack verify` — verify an imported instance is structurally complete
- Template packs automatically exclude credentials, sessions, memory databases, and `.env` files
- Three risk levels: `safe-share`, `internal-only`, `trusted-migration-only`
- JSON and text output formats for all commands
- End-to-end test suite covering the full inspect/export/import/verify pipeline
