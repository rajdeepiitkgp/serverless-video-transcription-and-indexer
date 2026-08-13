# ADR-0005: the smoke test seeds the upload's metadata document

- **Status**: Accepted
- **Date**: 2026-08-13
- **Amends**: IMPLEMENTATION_PLAN.md §9 (smoke test: "uploads a sample clip straight
  into the videos container") and §3's role list (deploy principal gains Cosmos DB
  data-plane access).

## Context

The plan contradicts itself. §9's smoke test uploads a clip **directly** into the
`videos` container and waits for results, but the §2 pipeline flow — correctly —
ignores any blob that has no metadata document: documents are created by
`POST /api/uploads` before the browser's direct PUT, and a blob arriving without one
is out-of-band by definition. The seventh Deploy all (2026-08-13, run 31711143763)
proved both halves work as designed and cannot compose: Event Grid delivered
BlobCreated to `ProcessVideoUpload`, which logged "No metadata document for blob —
not uploaded via the API; ignoring", and smoke timed out with zero results blobs.

Calling the real API from CI instead is not an option: the webapi sits behind Easy
Auth locked to SWA traffic (`/api/health` is the single anonymous route), and CI has
no AAD user. Weakening the pipeline guard to accept out-of-band blobs would change
production semantics to accommodate a test — backwards.

## Decision

`scripts/smoke-test.ts` seeds the same `Uploaded` document that
`services/webapi/src/core/upload-policy.ts#createUploadedDocument` writes — same
shape, same schema version, `uploadedBy` stamped `smoke-test` — directly into
Cosmos (`VideoAnalytics`/`VideoMetadata`) before uploading the blob, in the same
order the API uses (document first, then blob). The pipeline then processes the
upload exactly as it would a real one; no production code changes.

To write that document, the deploying principal (which also runs smoke) gets the
Cosmos **Built-in Data Contributor** data-plane role, assigned in
`infra/modules/rbac.bicep` via Bicep's `deployer()` function — no new parameters, no
GitHub-side configuration. It lives in Bicep, not `bootstrap-azure.sh`, because
Cosmos `sqlRoleAssignments` are stored on the account and die with it on destroy —
a bootstrap-time grant would not survive the destroy/recreate contract.

## Consequences

- Smoke now exercises the **entire** production write path: metadata document →
  blob → Event Grid → pipeline → Video Indexer → results, and its clip appears in
  the library attributed to `smoke-test` (the plan's "first library entry" behavior
  is preserved).
- The deploy principal can read/write Cosmos data. It already holds Storage Blob
  Data Contributor (bootstrap) — CI compromise already implied data access; this
  widens it to metadata, which the M7 hardening pass should revisit alongside the
  Blob Data Owner narrowing.
- `deployer()` grants whoever runs the deployment: a manual `az deployment` from a
  laptop assigns the human's objectId (additive; CI's grant persists once created
  by a CI run).
- The seeded document duplicates `createUploadedDocument`'s output rather than
  importing it (webapi is a Functions app, not an importable package, and smoke
  runs un-built under Node type stripping). Drift shows up loudly — the pipeline's
  schema-validated read rejects a malformed document — but keep the two in sync
  when the document shape changes.
