# ADR-0003: webapi runs on a Dedicated (B1) plan, keeping Node 24

- **Status**: Accepted
- **Date**: 2026-08-13
- **Amends**: IMPLEMENTATION_PLAN.md §2/§8 (webapi hosting: "Consumption (Y1) — Flex
  isn't supported for linked backends" → Dedicated B1). Preserves the §1 decision to
  run Node 24 everywhere.

## Context

The first live deploy (2026-08-13) failed at the webapi stage with the host hard-down:
instant 503s, zero log output, "Runtime version: Error" in the portal, and
`ServiceUnavailable` on every sync-triggers call. Live isolation (removing the
deployment package entirely, restarting, testing again) proved the container never
specialized at all.

Root cause: **Y1 Linux Consumption has no Node 24 image.** The platform's
`functionAppStacks` metadata is authoritative — `Node|24` on Linux lists SKUs
Dedicated, ElasticPremium, and Flex only, while `Node|22` (the current default) is
Y1's ceiling. ARM accepts `linuxFxVersion: NODE|24` on a Y1 site without validation
and the container silently never starts. (`az functionapp list-runtimes` is not
SKU-aware and misleadingly lists Node 24.) Y1 Linux is in maintenance mode with EOL
announced for 2028-09-30.

A live probe with `NODE|22` on the Y1 site brought the host up immediately —
confirming the diagnosis — but also surfaced a second Y1-specific defect: the
`WEBSITE_RUN_FROM_PACKAGE` blob-URL fetch via managed identity mounted nothing (host
healthy, "0 functions found") even with the roles from ADR-0002 in place, matching
long-unresolved reports
([functions-action#211](https://github.com/Azure/functions-action/discussions/211),
[azure-functions-host#9397](https://github.com/Azure/azure-functions-host/issues/9397)).

Options considered:

1. **webapi on Node 22, stay Y1** — accepts build-on-24/run-on-22 skew, keeps the
   broken-in-practice MI package fetch, and stays on the EOL path.
2. **Downgrade the whole repo to Node 22** — removes the skew but gives up Node 24
   everywhere, and still keeps Y1's other liabilities.
3. **Move webapi to Dedicated (B1)** — keeps Node 24, exits the Y1 EOL path, and
   switches deployment to plain zipdeploy (no blob-URL fetch, no SAS, no MI-fetch
   fragility), at ~$13/month for an always-on B1 instance.

The owner chose option 3 (2026-08-13). Flex remains the eventual destination but is
still unsupported for SWA linked backends.

## Decision

`webapi-app.bicep` provisions a **B1 Basic Linux** plan (`reserved: true`) with the
site on `linuxFxVersion: NODE|24` and `alwaysOn: true` (the Dedicated-plan
requirement for Functions). Everything else — SWA linked backend, keyless identity
configuration, default `/api` route prefix — is unchanged.

A Consumption plan cannot be converted or moved to Dedicated in place, and
`deploy-infra.yml` auto-deploys on any `main` push touching `infra/**` — so merging
this change over a live Y1 stack would immediately fail the in-place conversion on a
red `main`. The rollout order is therefore **Destroy → merge → Deploy all** (the
destroy-first step also clears the incident's ad-hoc role assignments before Bicep
re-creates the same triples under its own names), which the stack's
delete/recreate-safe contract exists to support.

## Consequences

- ~$13/month for the B1 plan; in exchange the API has no cold starts. The default
  monthly budget rises 10 → 25 USD to match (`BUDGET_AMOUNT`; the owner must also
  raise the GitHub `BUDGET_AMOUNT` variable if it's set to the old value, or the
  100%-actual and forecast alerts fire permanently).
- Deploys use the standard zipdeploy path; the M6 caveat about re-created
  `WEBSITE_RUN_FROM_PACKAGE` app settings no longer applies to webapi, but
  `deploy-all` keeps the webapi re-deploy after infra phase 2 as cheap insurance.
- The Y1 EOL migration advisory is moot for this stack.
- Revisit Flex Consumption for webapi if/when SWA linked backends support it
  (restores scale-to-zero and drops the B1 cost); that change would be a new ADR.
