# Repository Guidelines

## Project Structure & Module Organization

- `src/`: core TypeScript code (CLI, providers, routing, infra).
- `apps/`: native clients (macOS/iOS/Android).
- `ui/`: web control UI.
- `extensions/`: plugin packages.
- `docs/`: Mintlify documentation content.
- `test/`: integration/e2e suites and fixtures.
- Tests also live alongside code as `src/**/*.test.ts`.

## Build, Test, and Development Commands

- `pnpm install`: install dependencies.
- `pnpm dev` or `pnpm openclaw`: run the CLI locally.
- `pnpm build`: compile TypeScript and build bundles.
- `pnpm check`: typecheck, lint, and format.
- `pnpm test`: run the test runner; `pnpm test:coverage` for coverage.
- `pnpm ui:dev` / `pnpm ui:build`: run or build the web UI.
- `pnpm docs:dev`: local docs preview.

## Coding Style & Naming Conventions

- TypeScript (ESM). Prefer strict typing; `any` is disallowed by lint.
- Formatting is handled by `oxfmt`; linting by `oxlint` (see `.oxlintrc.json`).
- Swift code uses `swiftlint` and `swiftformat` via `pnpm lint:swift` / `pnpm format:swift`.
- Follow existing file and symbol naming patterns in each module.

## Testing Guidelines

- Framework: Vitest with V8 coverage thresholds at 70% for lines/branches/functions/statements.
- Unit tests: `*.test.ts` (colocated). E2E tests: `*.e2e.test.ts` (mostly in `test/`).
- Common runs: `pnpm test`, `pnpm test:e2e`, `pnpm test:coverage`.

## Commit & Pull Request Guidelines

- Git history favors short, scoped prefixes like `fix:`, `chore:`, `docs:`, `CLI:`, `Install:`, `Onboarding:` followed by a concise summary.
- Keep commits focused and avoid mixing unrelated changes.
- Before opening a PR, run `pnpm build && pnpm check && pnpm test`.
- PRs should explain what changed and why.
- If AI-assisted, mark it in the PR title/description and note testing level; include prompts or logs when possible (see `CONTRIBUTING.md`).

## Security & Configuration Tips

- Read `SECURITY.md` for reporting and runtime requirements (Node >= 22.12.0).
- Do not expose the web UI publicly; it is intended for local use.
- Never commit secrets; the repo uses detect-secrets in CI.
