# CLAUDE.md

Operational context for agent sessions. This is **not** a copy of the plan — the reviewed
contract for the build is [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (v5). Read the
relevant section before building anything; do not deviate from it silently.

**The plan is frozen** (as is `requirement.md`): both are read-only contract documents,
enforced by deny rules in `.claude/settings.json`. Corrections or scope changes are
recorded as ADRs in `docs/adr/` referencing the section they amend — never edits.

## What this is

Event-driven serverless video pipeline on Azure: browser upload → Blob Storage →
Event Grid → Functions → Azure Video Indexer → Cosmos DB + results container, with a
Next.js UI (Static Web Apps), full-text transcript search, and Discord notifications.
Everything in Bicep; destroy/recreate with zero manual portal steps.

## Commands

```bash
nvm use          # ALWAYS first — repo pins Node 24; your machine default is likely newer
pnpm install
pnpm lint        # prettier --check + turbo run lint (eslint)
pnpm typecheck
pnpm test
pnpm build
pnpm format      # prettier --write
pnpm replay --bundle <dir>  # re-run pipeline core on a diagnostics bundle (plan §7);
                            # sample bundles: services/pipeline/fixtures/bundles/*
pnpm diagnostics --id <id>  # download a video's diagnostics bundle + Cosmos doc to
                            # ./.diagnostics/<id>/ (auth: your own az login; plan §7)
pnpm smoke       # post-deploy E2E check — driven by deploy-all with SMOKE_* env vars
                 # (scripts/smoke-test.ts); scripts run directly under Node 24
pnpm dev         # local console at http://localhost:4280 (plan §11): SWA CLI auth
                 # emulator + /api proxy → Next dev (:3000) + webapi dev host (:7071 —
                 # real handlers, in-memory stores, seeded library, simulated pipeline:
                 # uploads index in ~10s, names containing "fail" fail; services/webapi/src/dev/)
```

## Non-negotiables

- **Node 24 pinned** (`.nvmrc` + `engines` + `engine-strict`) — matches the Azure
  Functions runtime. Never bump without checking Functions GA support.
- **pnpm only** (workspaces + turborepo). No npm/yarn.
- **Zero data-plane secrets**: system-assigned managed identity everywhere. The only
  secrets in the whole system are `DISCORD_WEBHOOK_URL` and `ANTHROPIC_API_KEY` (GitHub
  environment secrets). Never introduce a connection string.
- **All Azure resources in Bicep** (`infra/`), subscription-scope, delete/recreate-safe.
  No imperative `az` resource creation, no portal steps, no GitHub-side workarounds for
  things that belong in Azure (monitoring is Azure-native: availability test + alerts).
- **Strict TS**: no `any`, no default exports (framework files excepted), named exports,
  import order enforced. Presets live in `packages/config`.
- **TDD for domain logic** (`core/` in services): ports & adapters; Azure SDKs only in
  adapters; in-memory fakes at ports — never mock SDKs mid-stack. 80% coverage gate on
  `services/*` + `packages/shared`; `core/` parsers ~100%.
- **Tests never live in `src/`**: each package has a `tests/` tree mirroring `src/`
  1:1, helpers in `tests/support/` (docs/testing-principles.md "Where tests live").
  Sole exception: `services/pipeline/src/testing/fakes.ts` is runtime code for
  `pnpm replay` and stays in `src/`.
- **Conventional Commits** (commitlint via husky), trunk-based on `main`.
- **Never commit on `main`/`release/*`** — husky blocks it locally and GitHub rulesets
  reject direct pushes. Every change: `git switch -c <type>/<topic>` → commit → push →
  PR → wait for the `verify` check → **stop**. The repo owner reviews, approves, and
  merges every PR (head branch auto-deletes) — agents never merge or approve PRs.
  Don't rename the `verify` CI job — it's the required status check in the ruleset.
- **New dependencies at latest** — verify with `npm view <pkg> version` before adding;
  never hardcode a remembered version. Dependabot (weekly, grouped) keeps existing deps
  and workflow actions current; security fixes arrive as PRs. Exceptions live as
  `ignore` entries in `.github/dependabot.yml` (currently: TypeScript majors, until
  typescript-eslint supports TS 7).

## Gotchas

- SWA linked backend: webapi runs on **Dedicated (B1)** (ADR-0003 — Y1 Linux has no
  Node 24 image and Flex is unsupported for linked backends), keeps the default `/api`
  route prefix, SWA deploys with `api_location: ""`. A `linuxFxVersion` without an
  image for the plan SKU deploys cleanly but the container never starts: instant 503,
  zero logs, "Runtime version: Error" — check `functionAppStacks` SKU metadata, not
  `az functionapp list-runtimes` (not SKU-aware).
- Video Indexer callback goes to an **HTTP function** which republishes to the custom
  Event Grid topic — VI cannot send `aeg-sas-key`, so pointing it at the topic silently
  drops events (plan §2, deviation table).
- Two-phase infra deploy: Event Grid subscriptions (`deployEventSubscriptions=true`)
  only after function code is deployed. Phase 2 must also pass `viCallbackUrl` (the
  IndexingCallback URL **with its function key**, fetched at deploy time, never
  stored); phase 1 falls back to a keyless placeholder URL so the pipeline's zod
  config stays valid. Set `viArmApiVersion` only to override — an empty-string
  `VI_ARM_API_VERSION` app setting fails config validation, so Bicep omits it.
  `deploy-infra.yml` **self-phases**: it fetches the IndexingCallback key whenever
  pipeline code is already deployed and only then deploys subscriptions — so routine
  infra pushes converge to phase-2 state instead of clobbering the callback URL.
- M6 deploy-ordering caveat: re-running the infra deployment re-PUTs each Function
  App's app settings from Bicep — anything a code-deploy action added out-of-band
  gets wiped. `deploy-all` mitigates by re-deploying webapi code after infra phase 2
  (less critical since webapi moved to B1/zipdeploy — ADR-0003 — but kept as
  insurance).
- Function-app deploy artifacts are assembled with `pnpm --filter <pkg> deploy --prod
  <dir>`, which requires `injectWorkspacePackages: true` (pnpm-workspace.yaml):
  workspace deps are hard-linked copies, so `@vidx/shared` + its deps materialize
  into the artifact instead of leaving dangling symlinks (`--legacy` mode silently
  drops shared's own dependencies — zod-openapi — from the artifact; don't use it).
  Injection caveat: after adding a NEW file to packages/shared, run `pnpm install` so
  consumers' copies refresh. Each service's package.json `files` field (`dist` +
  `host.json`) defines the artifact. `staticwebapp.config.json` is NOT part of
  `next build` output — `deploy-web.yml` copies it into `apps/web/out/` before upload.
- Function-app identities need Storage Blob Data **Owner** + Queue/Table Data
  Contributor on the host storage account (ADR-0002) — the documented minimums for
  identity-based `AzureWebJobsStorage`; shortfalls reportedly fail silently.
- VI auth is ARM `generateAccessToken` via managed identity — key-based/classic VI auth
  is deprecated; don't use it.
- `.claude/skills/` holds vendored design skills (`frontend-design`, `ui-ux-pro-max`) —
  they drive the M4 UI work ("Signal" design language, plan §4).
- The watch-page player is **media-chrome**, not Vidstack — the plan §14 evaluation
  failed (stable Vidstack is React-18-only; its 1.x line is a perpetual prerelease) and
  §14's fallback was exercised. See docs/adr/0001-media-chrome-instead-of-vidstack.md.
- `services/pipeline` and `services/webapi` tests boot a throwaway **Azurite** on a
  random port (`tests/support/azurite-global-setup.ts` via vitest globalSetup, no
  Docker) for the blob-adapter integration tests;
  VI/Discord/Event Grid adapters test against local HTTP stubs; Cosmos adapters against
  SDK-shaped stubs (emulator optional/nightly). All part of plain `pnpm test`.
- webapi authn is **parsing `x-ms-client-principal`** (trustworthy only because Easy
  Auth locks the app to SWA traffic); `GET /api/health` is the single anonymous route —
  the carve-out itself lands in `staticwebapp.config.json` (M4).
- VI ARM api-version defaults to `2024-01-01`; override via `VI_ARM_API_VERSION` app
  setting if ARM drifts (plan §14 risk). Live verification pends the M5 deploy.
- pnpm 11 demands a verdict on dependency build scripts: it scaffolds an `allowBuilds`
  block into `pnpm-workspace.yaml` whose placeholder text is an **invalid value that
  breaks every install** until each entry is set `true`/`false`. Current entries
  (keytar, vue-demi) are deliberately `false` — see the comment there.
- A package stylesheet imported _inside_ a `next/dynamic` chunk gets dropped by the
  bundler — import it explicitly in your own module instead (bit us with Scalar on
  `/docs`: issue #10, fixed in PR #11; pattern in `docs-view.tsx`).

## Layout & milestone status

| Path                 | Contents                                                    | Milestone |
| -------------------- | ----------------------------------------------------------- | --------- |
| `packages/config`    | shared tsconfig/eslint/prettier presets                     | **M0 ✅** |
| `packages/shared`    | zod contracts → OpenAPI, VI insight parsers                 | **M1 ✅** |
| `services/pipeline`  | EG-triggered indexing pipeline + Discord                    | **M2 ✅** |
| `services/webapi`    | HTTP API (SWA linked backend) + local dev host (`src/dev/`) | **M3 ✅** |
| `apps/web`           | Next.js static export UI                                    | **M4 ✅** |
| `infra/`             | Bicep modules (subscription-scope, two-phase)               | **M5 ✅** |
| `.github/workflows/` | `ci.yml` + reports (M0/M6); deploys, destroy, AI review     | **M6 ✅** |

Full milestone table: plan §13. **Current: M6 code complete; bootstrap + GitHub
config done. First Deploy all (2026-08-13) failed at webapi — root cause: no Node 24
image on Y1 Linux (ADR-0003), plus under-scoped host-storage roles (ADR-0002); fix =
webapi on Dedicated B1. Remaining owner steps: merge the fix PR → run Destroy → run
Deploy all (required: Y1→B1 can't convert in place; also clears the incident's
ad-hoc role assignments; closes M5 live acceptance). M4 `pnpm dev` acceptance pass
still pending. Browser App Insights telemetry (plan §6) not yet wired in apps/web —
flagged for M7 hardening.**

## Docs

[CONTRIBUTING.md](CONTRIBUTING.md) · [docs/style-guide.md](docs/style-guide.md) ·
[docs/testing-principles.md](docs/testing-principles.md)
