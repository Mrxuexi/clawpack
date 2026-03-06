# Contributing to ClawPack

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/Mrxuexi/clawpack.git
cd clawpack
npm install
npm run build
npm test
```

Requires Node.js >= 20.

## Project Structure

```
src/
  cli.ts              # Entry point, command registration
  core/
    types.ts           # Shared type definitions and schema version
    scanner.ts         # Instance detection and inspection logic
    packer.ts          # Export and import logic (tar.gz packing)
    verifier.ts        # Post-import structural verification
  commands/
    inspect.ts         # `clawpack inspect` command
    export.ts          # `clawpack export` command
    import.ts          # `clawpack import` command
    verify.ts          # `clawpack verify` command
  utils/
    output.ts          # Text/JSON output formatting
test/
  e2e.test.ts          # End-to-end tests covering the full pipeline
docs/
  prds/                # Product requirement documents
```

## Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run build: `npm run build`
6. Commit with a descriptive message (conventional commits preferred)
7. Open a Pull Request

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests
- `chore:` tooling, CI, dependencies

## Running Tests

```bash
npm test            # Run once
npm run test:watch  # Watch mode
```

Tests are written with [Vitest](https://vitest.dev/) and located in `test/`.

## Code Style

- TypeScript strict mode
- ESM modules (`"type": "module"`)
- No external linter configured yet — keep code consistent with existing patterns

## Reporting Issues

Open an issue on GitHub with:
- What you expected
- What actually happened
- Steps to reproduce
- Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
