# Setup — from zero to a running stack

One-time bootstrap plus first deploy (plan §9). After this, every deploy is a
GitHub Actions run; nothing is ever clicked together in the Azure portal.

## Prerequisites

- Azure subscription (Owner — the bootstrap assigns roles)
- `az` CLI logged in (`az login`) against that subscription
- `gh` CLI logged in against the repo

## 1. Bootstrap the OIDC deploy identity (once, ever)

```bash
scripts/bootstrap-azure.sh
```

Creates the `vidx-github-deployer` Entra app registration with federated
credentials for `main`, `release/*`, the `production` environment, and
`pull_request` (what-if runs), and assigns Contributor + User Access
Administrator + Storage Blob Data Contributor (smoke-test uploads) on the
subscription. **No Azure credential is stored in GitHub — deploy auth is OIDC
only.** The registration survives resource-group teardown; you never run this
again.

## 2. GitHub `production` environment

Create the environment and set the variables (values from the bootstrap output
plus your choices):

```bash
REPO=rajdeepiitkgp/serverless-video-transcription-and-indexer
gh api -X PUT "repos/${REPO}/environments/production" > /dev/null

for kv in \
  "AZURE_CLIENT_ID=<from bootstrap>" \
  "AZURE_TENANT_ID=<from bootstrap>" \
  "AZURE_SUBSCRIPTION_ID=<from bootstrap>" \
  "AZURE_LOCATION=eastus" \
  "AZURE_RESOURCE_GROUP=rg-vidx-prod" \
  "PROJECT_NAME=vidx" \
  "RESOURCE_SUFFIX=01" \
  "BUDGET_ALERT_EMAIL=<your email>" \
  "BUDGET_AMOUNT=50"; do
  gh variable set "${kv%%=*}" --env production --repo "$REPO" --body "${kv#*=}"
done
```

Then the two secrets — the only secrets in the entire system. Copy each value
to the clipboard first so it never appears on screen or in shell history:

```bash
# Discord → channel → Integrations → Webhooks → copy URL, then:
pbpaste | gh secret set DISCORD_WEBHOOK_URL --env production --repo "$REPO"

# console.anthropic.com API key (AI PR review), then:
pbpaste | gh secret set ANTHROPIC_API_KEY --env production --repo "$REPO"
```

## 3. First deploy

Run the **Deploy all** workflow (Actions → Deploy all → Run workflow). It
sequences: infra phase 1 → webapi + pipeline + web code → infra phase 2 (Event
Grid subscriptions + keyed VI callback) → smoke test (generated clip uploaded,
polled to `Processed`, ✅ Discord embed).

After it goes green, verify the M5 acceptance items once:

- the SWA URL serves the app and `/api/health` returns 200 anonymously;
- calling the webapi app's **own** `azurewebsites.net` URL is rejected
  (SWA-exclusive Easy Auth);
- the availability test reports green in App Insights.

## 4. Grant yourself the `admin` role

Any Microsoft account can sign in with the `authenticated` role. `admin`
(delete anyone's videos) is granted only by SWA role invitation:

```bash
az staticwebapp users invite \
  --name "$(az staticwebapp list -g rg-vidx-prod --query '[0].name' -o tsv)" \
  --authentication-provider aad \
  --user-details you@example.com \
  --roles admin --invitation-expiration-in-hours 24
```

Open the printed invitation link while signed in as that account. Repeat after
every recreate (docs/teardown-recreate.md).

## 5. Test accounts (optional)

```bash
scripts/create-test-user.sh tester1 "Tester One"
```

Issues a free Entra tenant login (`tester1@<tenant>.onmicrosoft.com`) with a
generated password, forced password change on first sign-in, non-admin by
default. Revoke with `az ad user delete --id <upn>`.

## Local development

No Azure needed: `nvm use && pnpm install && pnpm dev` — see CLAUDE.md and
plan §11.
