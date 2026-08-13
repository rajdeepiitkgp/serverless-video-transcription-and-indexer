# Teardown & recreate

The whole stack lives in one resource group and is destroyed/recreated from
GitHub Actions with zero portal steps (plan §8). Destroy between sessions costs
≈ $0; the standing cost while deployed is dominated by SWA Standard (~$9/mo).

## Destroy

Actions → **Destroy** → Run workflow → type the resource group name
(`rg-vidx-prod`) into the confirmation box. The workflow refuses anything else,
then runs `az group delete`. Monitoring, alerts, and the budget die with the
RG — there is nothing external to clean up.

## What survives (by design)

| Survives                                              | Why                                                       |
| ----------------------------------------------------- | --------------------------------------------------------- |
| OIDC app registration (`vidx-github-deployer`)        | Subscription-level; bootstrap runs once, ever             |
| GitHub `production` environment (variables + secrets) | Nothing in it is stack-specific                           |
| Entra test users                                      | Tenant-level; delete with `az ad user delete` if unwanted |

## Recreate

Run **Deploy all**. No GitHub settings change: the SWA deploy token and the VI
callback function key are fetched at deploy time, never stored, so their
post-recreate values are picked up automatically.

Two follow-ups after a recreate:

1. **Re-invite `admin` role holders** — SWA role invitations die with the SWA
   (≈2 minutes, command in docs/setup.md §4).
2. **Discord/webhook unchanged** — the webhook lives in GitHub secrets and is
   re-injected into app settings by the deploy; nothing to do unless you
   rotated it.

## If a global name is stuck

Storage/Cosmos names can lag in reservation for a while after deletion. Bump
the `RESOURCE_SUFFIX` variable (e.g. `01` → `02`) and rerun Deploy all — every
globally-unique name derives from it, so the stack comes up under fresh names
with identical wiring.
