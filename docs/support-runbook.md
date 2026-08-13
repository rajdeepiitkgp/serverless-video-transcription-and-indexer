# Support runbook

How to go from a user's tracking ID to a diagnosis (plan §6/§7). Every error a
user sees carries a short code ("quote `VXT-a1b2c3d4` to support"); every
pipeline stage persists its raw inputs/outputs for offline replay.

## 1. Tracking ID → timeline (App Insights)

Open the shared App Insights instance (`vidx-prod-appi`) → Logs, and run:

```kusto
let tracking = "VXT-a1b2c3d4"; // ← the user's code
union traces, requests, exceptions, dependencies
| where tostring(customDimensions) contains tracking or operation_Id in (
    (union traces, requests, exceptions
     | where tostring(customDimensions) contains tracking
     | project operation_Id))
| project timestamp, itemType, cloud_RoleName, operation_Id,
          message = coalesce(message, name), customDimensions
| order by timestamp asc
```

Both function apps report into the same instance with W3C trace context, so
this stitches webapi and pipeline activity for the request into one story.
`cloud_RoleName` tells you which app each row came from. For pipeline flows,
`customDimensions` carries `uploadId`/`videoId` — pivot on those to widen from
one request to the video's whole upload → index → callback → results timeline.

## 2. Download the diagnostics bundle

```bash
az login   # RBAC read is enough
pnpm diagnostics --id <uploadId>
```

Pulls `results/<uploadId>/diagnostics/` (triggering Event Grid payload, VI
submit response, raw callback query, full VI index JSON, composed outputs) plus
`insights.json`/`transcript.vtt` and the Cosmos doc into
`./.diagnostics/<uploadId>/`.

The Cosmos doc fetch needs a data-plane role; grant support users read access
with:

```bash
az cosmosdb sql role assignment create \
  --resource-group rg-vidx-prod \
  --account-name "$(az cosmosdb list -g rg-vidx-prod --query '[0].name' -o tsv)" \
  --role-definition-id 00000000-0000-0000-0000-000000000001 \
  --principal-id "$(az ad signed-in-user show --query id -o tsv)" \
  --scope "/"
```

(`…0001` is the built-in Cosmos Data Reader; the blob bundle downloads fine
without it.)

## 3. Replay locally

```bash
pnpm replay --bundle ./.diagnostics/<uploadId>
```

Re-runs the real `ProcessVideoResults` core logic against the captured VI JSON
under a local debugger — the exact production execution, no Azure access
needed. Sample bundles for comparison: `services/pipeline/fixtures/bundles/`.

## Common signals

| Signal                    | Meaning                                              | First move                                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Availability alert email  | `/api/health` failing through the SWA domain         | `GET /api/health` manually; if `degraded`, the body names the sick dependency                                                                                                       |
| Dead-letter alert email   | Event Grid gave up delivering to a pipeline function | Inspect the `eventgrid-deadletter` container — each blob is the undeliverable event; fix, then re-upload or republish                                                               |
| Video stuck in `Indexing` | VI callback never arrived                            | Check the ❌/silence in Discord, then App Insights for `IndexingCallback`; a 401 there means the function key rotated — rerun **Deploy infra** (it re-wires the keyed callback URL) |
| ❌ Discord embed          | Pipeline reached a terminal failure                  | The embed carries the tracking ID → §1                                                                                                                                              |
| Budget email              | Monthly spend crossed a threshold                    | `az consumption usage list` or the portal cost analysis; destroy between sessions if idle                                                                                           |
