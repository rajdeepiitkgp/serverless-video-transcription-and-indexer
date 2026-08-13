// Plan §2/§8: API Function App on Consumption (Y1) — Flex isn't supported for linked
// backends — linked to the SWA so the platform's Easy Auth provider gives the static
// web app exclusive access. Linux + 64-bit (Node 24 requirement), default /api route
// prefix (host.json), keyless host storage. Deliberately NO
// WEBSITE_CONTENTAZUREFILECONNECTIONSTRING: Linux Consumption doesn't use an Azure
// Files content share, which is what keeps this app connection-string-free (§5).

@description('Consumption plan name')
param planName string

@description('API Function App name (globally unique)')
param appName string

@description('Azure region')
param location string

@description('Storage account backing the Functions host + media containers')
param storageAccountName string

@description('Blob service endpoint (with trailing slash)')
param blobEndpoint string

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

@description('Shared App Insights connection string (component owned by pipeline-app.bicep, §6)')
param appInsightsConnectionString string

@description('Name of the Static Web App to link this app to as its exclusive backend')
param swaName string

resource plan 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: planName
  location: location
  kind: 'functionapp'
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Linux
  }
}

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
      linuxFxVersion: 'NODE|24'
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false // 64-bit — Node 24 requirement (§1 decisions)
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storageAccountName }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'FUNCTIONS_EXTENSION_VERSION', value: '~4' }
        { name: 'FUNCTIONS_WORKER_RUNTIME', value: 'node' }
        { name: 'STORAGE_BLOB_ENDPOINT', value: blobEndpoint }
        { name: 'VIDEOS_CONTAINER', value: videosContainerName }
        { name: 'RESULTS_CONTAINER', value: resultsContainerName }
        { name: 'COSMOS_ENDPOINT', value: cosmosEndpoint }
        { name: 'COSMOS_DATABASE', value: cosmosDatabaseName }
        { name: 'COSMOS_CONTAINER', value: cosmosContainerName }
      ]
    }
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' existing = {
  name: swaName
}

// The link that creates the Easy Auth provider and locks this app to SWA traffic —
// direct calls to the app's own URL are rejected by the platform (§2).
resource linkedBackend 'Microsoft.Web/staticSites/linkedBackends@2024-04-01' = {
  parent: staticWebApp
  name: 'webapi'
  properties: {
    backendResourceId: site.id
    region: location
  }
}

output webApiAppName string = site.name
output webApiAppPrincipalId string = site.identity.principalId
output webApiHostname string = site.properties.defaultHostName
