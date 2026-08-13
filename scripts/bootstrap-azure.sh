#!/usr/bin/env bash
# One-time bootstrap (plan §9): Entra app registration + GitHub OIDC federated
# credentials + subscription-level role assignments. Run once, ever — the app
# registration lives at subscription level and survives resource-group teardown
# (§8 teardown table), so destroy/recreate cycles never touch it.
#
# No Azure credential ever lands in GitHub: deploys authenticate via OIDC only.
# After this script, copy the printed values into the GitHub `production`
# environment as variables (docs/setup.md walks through it).
#
# Usage: scripts/bootstrap-azure.sh [github-owner/repo] [app-display-name]
set -euo pipefail

REPO="${1:-rajdeepiitkgp/serverless-video-transcription-and-indexer}"
APP_NAME="${2:-vidx-github-deployer}"

echo "==> Bootstrapping OIDC deploy identity for github.com/${REPO}"
az account show --query '{subscription: name, id: id, tenant: tenantId}' -o table

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

# --- App registration + service principal (idempotent) ---

APP_ID="$(az ad app list --display-name "${APP_NAME}" --query '[0].appId' -o tsv)"
if [[ -z "${APP_ID}" ]]; then
  echo "==> Creating app registration '${APP_NAME}'"
  APP_ID="$(az ad app create --display-name "${APP_NAME}" --query appId -o tsv)"
else
  echo "==> App registration '${APP_NAME}' already exists (${APP_ID})"
fi

if [[ -z "$(az ad sp list --filter "appId eq '${APP_ID}'" --query '[0].id' -o tsv)" ]]; then
  echo "==> Creating service principal"
  az ad sp create --id "${APP_ID}" --query id -o tsv > /dev/null
fi

# --- Federated credentials: main + release/* + production environment (§9) ---
# The deploy jobs all run inside the `production` GitHub environment, so the
# environment credential is the one that matters for deploys; the branch
# credentials cover any non-environment OIDC use. release/* needs a flexible
# credential (claims matching expression) because exact-match subjects cannot
# wildcard. The pull_request credential lets same-repo PRs run the read-only
# `what-if` job (fork PRs can never mint OIDC tokens, so they are excluded by
# GitHub itself).
#
# GitHub presents OIDC subjects in the ID-qualified form
# `repo:<owner>@<owner-id>/<repo>@<repo-id>:...` — exact-match credentials must
# use that exact string (classic `repo:owner/repo:...` subjects fail with
# AADSTS700213). The IDs are immutable, which also makes these rename-proof.

ISSUER="https://token.actions.githubusercontent.com"
AUDIENCE="api://AzureADTokenExchange"

OWNER_ID="$(gh api "repos/${REPO}" --jq .owner.id)"
REPO_ID="$(gh api "repos/${REPO}" --jq .id)"
SUBJECT_PREFIX="repo:${REPO%%/*}@${OWNER_ID}/${REPO#*/}@${REPO_ID}"
echo "==> OIDC subject prefix: ${SUBJECT_PREFIX}"

# Create-or-update so re-runs converge existing credentials onto the current
# subject format instead of skipping them.
ensure_fic() {
  local name="$1" subject="$2"
  local params="{
    \"name\": \"${name}\",
    \"issuer\": \"${ISSUER}\",
    \"subject\": \"${subject}\",
    \"audiences\": [\"${AUDIENCE}\"]
  }"
  if az ad app federated-credential show --id "${APP_ID}" --federated-credential-id "${name}" > /dev/null 2>&1; then
    echo "==> Updating federated credential '${name}' (${subject})"
    az ad app federated-credential update --id "${APP_ID}" --federated-credential-id "${name}" --parameters "${params}"
  else
    echo "==> Creating federated credential '${name}' (${subject})"
    az ad app federated-credential create --id "${APP_ID}" --parameters "${params}"
  fi
}

ensure_fic "github-main" "${SUBJECT_PREFIX}:ref:refs/heads/main"
ensure_fic "github-env-production" "${SUBJECT_PREFIX}:environment:production"
ensure_fic "github-pull-request" "${SUBJECT_PREFIX}:pull_request"

if ! az ad app federated-credential show --id "${APP_ID}" --federated-credential-id "github-release-branches" > /dev/null 2>&1; then
  echo "==> Creating flexible federated credential for release/* branches"
  az rest --method post \
    --url "https://graph.microsoft.com/beta/applications(appId='${APP_ID}')/federatedIdentityCredentials" \
    --body "{
      \"name\": \"github-release-branches\",
      \"issuer\": \"${ISSUER}\",
      \"audiences\": [\"${AUDIENCE}\"],
      \"claimsMatchingExpression\": {
        \"value\": \"claims['sub'] matches '${SUBJECT_PREFIX}:ref:refs/heads/release/*'\",
        \"languageVersion\": 1
      }
    }" || cat <<'EOF'
WARNING: the flexible federated credential (claims matching expression) was rejected —
some tenants do not accept expressions for the GitHub issuer. This is fine: deploys
from release/* run in the `production` environment and are covered by the
github-env-production credential. Re-run this script later to retry.
EOF
else
  echo "==> Federated credential 'github-release-branches' already exists"
fi

# --- Subscription-scope roles: create the RG + everything in it, and assign RBAC
# (rbac.bicep / video-indexer.bicep role assignments need User Access Administrator).
# Storage Blob Data Contributor is the one data-plane role the deploy identity holds:
# the smoke test uploads its sample clip directly to the videos container (shared-key
# access is disabled stack-wide, so RBAC is the only way in).

for role in "Contributor" "User Access Administrator" "Storage Blob Data Contributor"; do
  echo "==> Ensuring role '${role}' on subscription"
  az role assignment create \
    --assignee "${APP_ID}" \
    --role "${role}" \
    --scope "/subscriptions/${SUBSCRIPTION_ID}" \
    --only-show-errors > /dev/null || true
done

cat <<EOF

==> Bootstrap complete. Set these as GitHub *variables* in the 'production'
    environment (Settings → Environments → production):

    AZURE_CLIENT_ID=${APP_ID}
    AZURE_TENANT_ID=${TENANT_ID}
    AZURE_SUBSCRIPTION_ID=${SUBSCRIPTION_ID}

    Plus (see docs/setup.md): AZURE_LOCATION, AZURE_RESOURCE_GROUP, PROJECT_NAME,
    RESOURCE_SUFFIX, BUDGET_ALERT_EMAIL, BUDGET_AMOUNT — and the two secrets
    DISCORD_WEBHOOK_URL and ANTHROPIC_API_KEY.

    No Azure secret goes to GitHub: this identity authenticates via OIDC only.
EOF
