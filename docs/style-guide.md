# Style guide

Rules are tool-enforced wherever possible (ESLint/Prettier/tsc presets in
`packages/config`); this document records the rationale and the rules tools can't check.

## TypeScript

- **Strict everything**: `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride` — see
  `packages/config/typescript/base.json`. Don't weaken a preset in a package; propose a
  change to the preset instead.
- **No `any`** — enforced by `typescript-eslint` strict-type-checked. For genuinely
  unknown input use `unknown` and narrow with zod at the boundary.
- **No default exports** (ESLint-enforced). Named exports keep renames honest and
  imports greppable. Framework-mandated files (e.g. Next.js pages, config files) may
  override locally with an eslint disable comment naming the framework.
- **Import order** enforced by `simple-import-sort` (autofixable) — never hand-sort.
- **Type imports** are inline: `import { type Foo, bar } from '…'`.
- `no-console` — use the structured logger (App Insights) in services; console is fine
  in scripts (override in the script package's eslint config).
- Validation: **zod at every boundary** (HTTP payloads, Event Grid events, VI
  responses); parsed types flow inward — no re-validation mid-stack.

## Error handling & logging

- Every error path carries a **`trackingId`** (`VXT-xxxxxxxx`) — surfaced to the user,
  logged to App Insights, searchable via the support runbook.
- Errors returned by APIs use the shared response envelope from `packages/shared`;
  never leak stack traces or config to clients.
- Log **who/what/when** on every authenticated request (`userId`, `userDetails`,
  operation) — the audit trail is a product requirement.
- Stamp `uploadId`/`videoId` as custom dimensions on all pipeline logs so a video's
  whole timeline stitches together.
- Notification (Discord) failures are logged warnings — they must never fail the
  pipeline.

## React (apps/web — lands in M4)

- Function components only; hooks for all state; no classes.
- Components colocated with their tests; test with React Testing Library — assert on
  what the user sees, not implementation details.
- Server data flows through typed API-client hooks; components never call `fetch`
  directly.

## Tailwind / CSS (apps/web — lands in M4)

- Design tokens as CSS variables (the "Signal" palette), consumed via Tailwind theme —
  no hard-coded colors in class names.
- Class merging via `cn()` (clsx + tailwind-merge); variants via `cva`.
- No `@apply` sprawl: `@apply` only inside component-layer CSS for genuinely shared
  primitives.
- No inline `style=` attributes; arbitrary values (`w-[…]`) only with a comment
  justifying why a token doesn't fit.
- Mobile-first responsive classes; class order is machine-sorted by
  `prettier-plugin-tailwindcss` (added with the web app in M4).

## Naming & folders

- Files: kebab-case (`insight-parser.ts`); React components: PascalCase files are
  allowed where shadcn conventions require them.
- Folders by feature, not by kind, inside each package (`core/`, `ports/`, `adapters/`,
  `functions/` in services — see testing principles for what goes where).
- Workspace packages are scoped `@vidx/*`.

## Cosmos schema versioning

Cosmos is schemaless; the shape is governed by the shared zod schema and stamped
`schemaVersion` (currently `1`). Evolution policy:

1. **Additive change** (new optional field): extend the zod schema; readers must
   tolerate documents missing the field. No version bump.
2. **Breaking change** (rename/retype/remove): bump `schemaVersion`, keep the reader
   tolerant of both versions (zod union or transform), and — only if old docs must be
   upgraded — ship a one-off backfill script under `scripts/`.
3. Never write migrations that must run before deploy; readers-tolerate-writers is the
   invariant that keeps delete/recreate and rolling deploys safe.
