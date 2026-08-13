# ADR-0002: Function-app storage roles are Blob Data Owner + Queue/Table Data Contributor

- **Status**: Accepted
- **Date**: 2026-08-13
- **Amends**: IMPLEMENTATION_PLAN.md §5 (managed-identity table: "webapi app → Storage
  … System MI + Storage Blob Data Contributor", and the same role named for the
  pipeline app), §3 (rbac.bicep role list).

## Context

The first live deploy (Deploy all, 2026-08-13) failed at the webapi stage: the
Functions host on the Y1 Linux Consumption plan never started, so the deploy action's
final sync-triggers call got `ServiceUnavailable` from the host runtime. The app
emitted zero telemetry and zero platform log events — it died before loading
`host.json`. The pipeline app (Flex Consumption), configured identically except for
the plan, was healthy.

The plan granted both apps **Storage Blob Data Contributor** only. That is
insufficient for the host's identity-based `AzureWebJobsStorage__accountName`
connection:

- [Functions "Define connections" docs](https://learn.microsoft.com/en-us/azure/azure-functions/manage-connections)
  state Storage **Blob Data Owner** is "the minimum storage account permissions for
  the host-required `AzureWebJobsStorage` connection", plus **Table Data
  Contributor** for host diagnostic events.
- On the (non-Flex) Consumption plan the host also needs **Queue Data Contributor**
  to initialize — reported failures without it are silent
  ([azure-functions-host#9397](https://github.com/Azure/azure-functions-host/issues/9397)).
  webapi has since moved to Dedicated (ADR-0003), where the same documented
  minimums apply; the role set is kept plan-agnostic deliberately.

Granting the three roles live (2026-08-13) did **not** by itself bring the host up —
the webapi outage had a second, independent cause (no Node 24 image on Y1 Linux,
ADR-0003). The role change stands on the documentation's stated minimums for
identity-based host storage rather than on observed breakage, and removes a
known-silent failure mode rather than explaining this particular outage.

## Decision

Both function-app identities get, on the storage account, in `rbac.bicep`:

- **Storage Blob Data Owner** (host minimum; superset of the
  `generateUserDelegationKey` permission the apps use to mint user-delegation SAS,
  and of the results/diagnostics blob I/O the plan assigned to Blob Data Contributor)
- **Storage Queue Data Contributor** (host initialization on Consumption)
- **Storage Table Data Contributor** (host diagnostic events)

The Event Grid system/custom topic identities keep plain **Storage Blob Data
Contributor** — dead-letter writes need nothing more.

## Consequences

- Still zero data-plane secrets. The role breadth does widen meaningfully: Blob Data
  Owner adds container-delete and blob-ACL/ownership actions over the shared media
  account, beyond the read/write/delete-blob surface Contributor already granted.
  Accepted: both identities are the trusted data-plane of this stack by design, and
  the ACL actions are inert on this flat-namespace account (`isHnsEnabled` unset).
- The apps' Bicep-created Blob Data Contributor assignments are superseded but not
  deleted (incremental deployments don't remove resources); they are harmless.
- The three role assignments created ad hoc during the 2026-08-13 incident would
  collide with the next infra deploy (Bicep PUTs the same (principal, role, scope)
  triples under different deterministic names, and ARM rejects duplicate triples
  with `RoleAssignmentExists`) — but the Destroy → Deploy all rollout that ADR-0003
  already requires deletes them together with the resource group. Manual
  `az role assignment delete` is only needed if the destroy step is skipped.
