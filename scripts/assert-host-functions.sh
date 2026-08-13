#!/usr/bin/env bash
# Assert a Function App's host actually registered functions after a deploy.
# The deploy actions report success either way (2026-08-13 incidents).
#
# Polls the HOST RUNTIME admin API — the source of truth. ARM's
# sites/<app>/functions list is only a cache refreshed by a sync-triggers
# call, and the Kudu zipdeploy path (B1/RBAC) never syncs it: the fourth
# Deploy all had all 12 webapi functions live on the host one minute after
# zipdeploy while ARM reported zero for 10+ minutes. On success this script
# syncs the cache so ARM consumers (portal, function-key lookups) converge.
#
# The ~10-minute ceiling absorbs a Dedicated (B1) site-container restart,
# observed at ~6 minutes; Flex registers in seconds and exits early.
set -euo pipefail

rg="${1:?usage: assert-host-functions.sh <resource-group> <app-name>}"
app="${2:?usage: assert-host-functions.sh <resource-group> <app-name>}"

site="/subscriptions/$(az account show --query id --output tsv)/resourceGroups/${rg}/providers/Microsoft.Web/sites/${app}"

for _ in $(seq 1 40); do
  count="$(az rest --method get \
    --url "https://management.azure.com${site}/hostruntime/admin/functions?api-version=2024-04-01" \
    --query 'length(@)' --output tsv 2>/dev/null || echo 0)"
  if [[ "${count:-0}" -gt 0 ]]; then
    echo "Host registered $count function(s)."
    az rest --method post \
      --url "https://management.azure.com${site}/syncfunctiontriggers?api-version=2024-04-01" \
      --output none
    exit 0
  fi
  sleep 15
done

echo "::error::Host loaded zero functions after deploy (see the CLAUDE.md artifact gotcha)."
exit 1
