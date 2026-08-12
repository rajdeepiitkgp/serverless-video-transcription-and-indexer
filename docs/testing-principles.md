# Testing principles

## Where tests live

Tests are **never colocated with source**. Every package keeps its app code in `src/`
and its tests in a sibling `tests/` tree that **mirrors `src/` 1:1**:

```
<package>/
├── src/core/upload-policy.ts
└── tests/
    ├── core/upload-policy.test.ts   # same subpath as the code under test
    └── support/                     # shared helpers: builders, fakes, deps bags,
                                     #   Azurite global setup, HTTP stubs
```

- No `*.test.ts` (or `.test.tsx`) anywhere under `src/`.
- Test helpers go in `tests/support/`, not next to specs.
- The rule is repo-wide: `apps/web` follows it too (`apps/web/tests/components/…`).
- **One exception**: `services/pipeline/src/testing/fakes.ts` stays in `src/` because
  it is _runtime_ code — the replay harness (`pnpm replay`, plan §7) executes on those
  fakes, so the build ships them. It is port-implementing infrastructure, not a test.

## The pyramid

From most tests to fewest:

## 1. Unit — pure domain (`core/`)

- The bulk of all tests. `core/` is pure TypeScript (insight parsing, SAS policy,
  status state machine, notification composition, playability rules) with **no Azure
  SDK imports**, so unit tests are **mock-free by design**.
- **TDD**: write the failing test first for every behavior. Target ~100% coverage on
  parsers — they encode the VI JSON contract.
- Fixtures are real captured payloads in the **diagnostics-bundle format** (see plan
  §7), so production incidents replay directly as test cases.

## 2. Handler / component

- Function handlers are thin wiring over a composition root; test them with
  **in-memory fakes implementing the ports** (`FakeMetadataRepository`,
  `FakeVideoIndexerClient`, …).
- **Never mock Azure SDKs mid-stack.** If a test needs an SDK mock, the code under
  test is reaching past its port — fix the design, not the test.
- React components: Vitest + React Testing Library; assert user-visible behavior.

## 3. Integration — adapters

- Each adapter is tested against a real local dependency: **Azurite** for blob/queue
  storage, a **local HTTP stub** for Discord webhooks; runs in CI.
- Cosmos adapter: emulator-based tests are optional/nightly (the emulator is heavy);
  the adapter surface stays thin enough that fakes cover the logic.

## 4. E2E

- Post-deploy **smoke test** (`scripts/smoke-test.ts`): upload a short clip, poll until
  `Processed`, verify insights + captions + Discord ping. Runs at the end of
  `deploy-all`.
- Playwright browser E2E is a stretch goal, not a gate.

## Coverage & CI

- **80% lines/branches** gate on `services/*` and `packages/shared` (Vitest v8
  provider, enforced per-package in CI); `core/` parsers ~100%.
- `ci.yml` runs lint → typecheck → test → build on every push and PR, on the pinned
  Node version (reads `.nvmrc`).
- A regression fix always starts with the failing test that reproduces it.

## Fixtures = diagnostics bundles

One format everywhere: the diagnostics capture written by the pipeline
(`results/{uploadId}/diagnostics/`) is the same shape tests consume and the local
replay harness (`pnpm replay`) runs. Adding a fixture from production is `pnpm
diagnostics --id <uploadId>` + copy.
