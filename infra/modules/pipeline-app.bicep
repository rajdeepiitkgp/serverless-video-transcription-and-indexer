// Plan §3: Pipeline Function App (Flex Consumption) + App Insights + Log Analytics.
// The single App Insights instance for the whole stack lives here (§6) and is shared
// by webapi via output. Keyless throughout: identity-based host storage, identity-based
// Flex deployment storage, managed-identity data planes. Telemetry sampling is
// host-side (each service's host.json, adaptive); Bicep contributes the workspace
// daily cap + retention to keep App Insights within pennies (§6).

@description('Log Analytics workspace name')
param logAnalyticsName string

@description('Application Insights component name')
param appInsightsName string

@description('Flex Consumption plan name')
param planName string

@description('Pipeline Function App name (globally unique)')
param appName string

@description('Azure region')
param location string

@description('Log Analytics daily ingestion cap in GB (string — fractional values allowed)')
param dailyCapGb string

@description('Storage account backing the Functions host + media containers')
param storageAccountName string

@description('Blob service endpoint of that account (with trailing slash)')
param blobEndpoint string

@description('Container holding Flex deployment packages')
param deploymentsContainerName string

@description('Uploads container name')
param videosContainerName string

@description('Results container name')
param resultsContainerName string

@description('Cosmos account endpoint URL')
param cosmosEndpoint string

@description('Cosmos database name')
param cosmosDatabaseName string

@description('Cosmos container name')
param cosmosContainerName string

@description('Custom Event Grid topic endpoint the pipeline publishes to')
param eventGridTopicEndpoint string

@description('Resource group holding the Video Indexer account (for generateAccessToken)')
param viResourceGroupName string

@description('Video Indexer ARM account name')
param viAccountName string

@description('Video Indexer data-plane account GUID')
param viAccountId string

@description('Video Indexer account region')
param viLocation string

@description('Phase 2: full IndexingCallback URL including the function key. Empty in phase 1 — a keyless placeholder URL keeps config validation green until the key exists (§8 two-phase deploy).')
@secure()
param viCallbackUrl string = ''

@description('Optional VI ARM api-version override; empty omits the app setting entirely (the code defaults to 2024-01-01, and an empty value would fail its config validation)')
param viArmApiVersion string = ''

@description('Discord webhook URL — the only data-plane secret in the system (§5)')
@secure()
param discordWebhookUrl string

@description('SWA default hostname, used to build watch-page links in Discord embeds')
param swaHostname string

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: json(dailyCapGb)
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'FC1'
    tier: 'FlexConsumption'
  }
  properties: {
    reserved: true
  }
}

// Phase 1 placeholder: valid URL (satisfies the zod schema at host start) but keyless,
// so it just 401s if ever hit. Phase 2 passes the real keyed URL (§8).
var callbackUrlValue = empty(viCallbackUrl)
  ? 'https://${appName}.azurewebsites.net/api/indexing-callback'
  : viCallbackUrl

var baseAppSettings = [
  // Identity-based host storage — no AzureWebJobsStorage connection string, ever (§5).
  { name: 'AzureWebJobsStorage__accountName', value: storageAccountName }
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
  { name: 'STORAGE_BLOB_ENDPOINT', value: blobEndpoint }
  { name: 'VIDEOS_CONTAINER', value: videosContainerName }
  { name: 'RESULTS_CONTAINER', value: resultsContainerName }
  { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
  { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
  { name: 'COSMOS_CONTAINER', value: cosmosContainerName }
  { name: 'EVENT_GRID_TOPIC_ENDPOINT', value: eventGridTopicEndpoint }
  { name: 'VI_SUBSCRIPTION_ID', value: subscription().subscriptionId }
  { name: 'VI_RESOURCE_GROUP', value: viResourceGroupName }
  { name: 'VI_ACCOUNT_NAME', value: viAccountName }
  { name: 'VI_ACCOUNT_ID', value: viAccountId }
  { name: 'VI_LOCATION', value: viLocation }
  { name: 'VI_CALLBACK_URL', value: callbackUrlValue }
  { name: 'DISCORD_WEBHOOK_URL', value: discordWebhookUrl }
  { name: 'WEB_BASE_URL', value: 'https://${swaHostname}' }
  { name: 'APP_INSIGHTS_PORTAL_URL', value: 'https://portal.azure.com/#resource${appInsights.id}/overview' }
]

resource site 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      minTlsVersion: '1.2'
      appSettings: concat(
        baseAppSettings,
        empty(viArmApiVersion) ? [] : [{ name: 'VI_ARM_API_VERSION', value: viArmApiVersion }]
      )
    }
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${blobEndpoint}${deploymentsContainerName}'
          authentication: {
            type: 'SystemAssignedIdentity'
          }
        }
      }
      runtime: {
        name: 'node'
        version: '24'
      }
      scaleAndConcurrency: {
        maximumInstanceCount: 100
        instanceMemoryMB: 2048
      }
    }
  }
}

output pipelineAppName string = site.name
output pipelineAppPrincipalId string = site.identity.principalId
output appInsightsId string = appInsights.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output logAnalyticsId string = logAnalytics.id
