# Contributing

## Setup

```bash
nvm use        # repo pins Node 24 (.nvmrc); engine-strict rejects anything else
corepack enable # or: npm i -g pnpm@11
pnpm install
```

`pnpm install` wires the git hooks (husky). If hooks don't run, re-run `pnpm install`.

## Branching & commits

- **Trunk-based**: short-lived branches off `main`; `release/**` only for release cuts.
- Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- **Conventional Commits**, enforced by commitlint on every commit:
  `feat(webapi): add search endpoint`, `fix(pipeline): retry VI token fetch`.
- Pre-commit runs Prettier on staged files (lint-staged).

## Pull requests

- Small, one concern per PR. Split refactors from behavior changes.
- All checks green (`ci.yml` is a required check): lint, typecheck, tests, build,
  coverage gate.
- AI review (Claude Code GitHub Action) comments must be addressed — resolve or rebut,
  don't ignore. (Workflow lands in M6.)
- Deploys: automatic on `main`/`release/**` (path-filtered); manual dispatch elsewhere.
  Fork PRs never deploy and never see secrets.

## Quality bar

- `pnpm lint && pnpm typecheck && pnpm test && pnpm build` must pass locally before
  pushing.
- New domain logic (`core/`) is written test-first; see
  [docs/testing-principles.md](docs/testing-principles.md).
- Code style is tool-enforced; the rationale lives in
  [docs/style-guide.md](docs/style-guide.md).
- Coverage gate: 80% lines/branches on `services/*` and `packages/shared`.

## Project contract

Architecture and scope decisions live in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
(frozen after M7) and, as they graduate, in `docs/` and ADRs under `docs/adr/`. If a
change contradicts the plan, raise it in the PR — don't drift silently.
