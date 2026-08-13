// Values come from the GitHub `production` environment (plan §9) via env vars at
// deploy time; the defaults here only serve local lint/what-if runs.
using 'main.bicep'

param projectName = readEnvironmentVariable('PROJECT_NAME', 'vidx')
param location = readEnvironmentVariable('AZURE_LOCATION', 'eastus')
param resourceGroupName = readEnvironmentVariable('AZURE_RESOURCE_GROUP', 'rg-vidx-prod')
param resourceSuffix = readEnvironmentVariable('RESOURCE_SUFFIX', '01')
param budgetAmount = int(readEnvironmentVariable('BUDGET_AMOUNT', '25'))
param budgetAlertEmail = readEnvironmentVariable('BUDGET_ALERT_EMAIL', 'nobody@example.com')
param discordWebhookUrl = readEnvironmentVariable('DISCORD_WEBHOOK_URL', '')
param deployEventSubscriptions = bool(readEnvironmentVariable('DEPLOY_EVENT_SUBSCRIPTIONS', 'false'))
param viCallbackUrl = readEnvironmentVariable('VI_CALLBACK_URL', '')
