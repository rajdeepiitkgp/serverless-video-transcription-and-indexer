#!/usr/bin/env bash
# Issue a real, free Entra tenant login account for testers (plan §9): they sign in
# through the normal Microsoft login, get the `authenticated` SWA role only (never
# admin — that's granted exclusively by SWA role invitation), and must change the
# generated password on first sign-in. Revoke by deleting the user.
#
# Usage: scripts/create-test-user.sh <username> ["Display Name"]
#   e.g. scripts/create-test-user.sh tester1 "Tester One"
set -euo pipefail

USERNAME="${1:?usage: create-test-user.sh <username> [\"Display Name\"]}"
DISPLAY_NAME="${2:-${USERNAME}}"

TENANT_DOMAIN="$(az rest --method get \
  --url 'https://graph.microsoft.com/v1.0/organization?$select=verifiedDomains' \
  --query 'value[0].verifiedDomains[?isDefault].name | [0]' -o tsv)"
UPN="${USERNAME}@${TENANT_DOMAIN}"

# 24 chars of base64 satisfies Entra complexity; shown once, then owned by the tester.
PASSWORD="$(openssl rand -base64 24)"

echo "==> Creating ${UPN}"
az ad user create \
  --display-name "${DISPLAY_NAME}" \
  --user-principal-name "${UPN}" \
  --password "${PASSWORD}" \
  --force-change-password-next-sign-in true \
  --query '{userPrincipalName: userPrincipalName, id: id}' -o table

cat <<EOF

==> Hand these to the tester (they set their own password on first sign-in):

    Sign-in:  ${UPN}
    Password: ${PASSWORD}

    Revoke anytime with: az ad user delete --id ${UPN}
EOF
