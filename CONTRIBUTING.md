# Contributing

## Setup

```bash
nvm use        # repo pins Node 24 (.nvmrc); engine-strict rejects anything else
corepack enable # or: npm i -g pnpm@11
pnpm install
```

`pnpm install` wires the git hooks (husky). If hooks don't run, re-run `pnpm install`.

## Branching & commits

- **Never commit directly to `main` or `release/**`** — the husky pre-commit hook
  blocks it locally, and GitHub rulesets reject direct pushes. All changes land via
  **feature branch → PR → green CI → merge**.
- **Trunk-based**: short-lived branches off `main`; `release/**` only for release cuts.
- Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Flow: `git switch -c feat/<topic>` → commit → push → `gh pr create` → CI (`verify`)
  must pass → **review, approval, and merge by the repo owner**. Agent sessions stop
  once `verify` is green and hand the PR over for review — they never merge or approve.
  **Merged head branches are deleted automatically** (repo setting); don't reuse them.
- `main` and `release/*` are protected by ruleset: PRs required, `verify` status check
  required, force pushes and deletion blocked.
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

## Dependencies

- **New packages are added at their latest version** — check the registry
  (`npm view <pkg> version`) at add time; never copy a version from an old example or
  tutorial. If latest can't be used, pin the newest workable version and record why in
  the PR (and an `ignore` entry in `.github/dependabot.yml` if majors must be blocked).
- **Dependabot** opens grouped weekly update PRs (npm + GitHub Actions) and immediate
  security-fix PRs. Treat them as first-class: merge or explicitly rebut promptly —
  letting them pile up recreates the big-bang-upgrade problem they exist to prevent.
- Current deliberate exceptions: TypeScript stays `~6.0` until typescript-eslint
  supports TS 7 (Dependabot ignores that major); Node stays 24 LTS to match the Azure
  Functions runtime (repo-pinned, not a Dependabot concern).

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
