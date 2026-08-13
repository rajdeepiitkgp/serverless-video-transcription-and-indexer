// Plan §2/§8 as amended by ADR-0003: API Function App on Dedicated (B1). Y1 Linux
// has no Node 24 image (container never specializes: instant 503s, zero logs) and
// Flex isn't supported for linked backends, so B1 is the plan that keeps Node 24
// under an SWA linked backend — and exits the Y1-Linux EOL (2028-09-30) path.
// Linked to the SWA so the platform's Easy Auth provider gives the static web app
// exclusive access. Linux + 64-bit, default /api route prefix (host.json), keyless
// host storage. Deliberately NO WEBSITE_CONTENTAZUREFILECONNECTIONSTRING: Dedicated
// plans don't use an Azure Files content share, which is what keeps this app
// connection-string-free (§5).

@description('Dedicated (B1) plan name')
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
  kind: 'linux' // conventional for Dedicated Linux plans ('functionapp' was the Y1 idiom); reserved:true is what actually selects Linux
  sku: {
    name: 'B1'
    tier: 'Basic'
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
      // NODE|24 exists for Dedicated/EP/Flex but NOT Y1 — the functionAppStacks SKU
      // metadata is authoritative (ADR-0003); an unsupported linuxFxVersion deploys
      // cleanly but the container never specializes.
      linuxFxVersion: 'NODE|24'
      alwaysOn: true // Dedicated-plan requirement for Functions
      minTlsVersion: '1.2'
      use32BitWorkerProcess: false // 64-bit — Node 24 requirement (§1 decisions)
      appSettings: [
        // Pinned declaratively so a standalone infra re-PUT (which wipes settings
        // the code-deploy action adds out-of-band) can never re-enable a remote
        // Oryx build — the artifact is prebuilt, and its workspace:* deps are
        // unresolvable by npm install (CLAUDE.md gotcha).
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
        { name: 'ENABLE_ORYX_BUILD', value: 'false' }
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
