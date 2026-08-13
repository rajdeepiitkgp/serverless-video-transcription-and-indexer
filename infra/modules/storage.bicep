// Plan §3/§8: storage account + containers + CORS (upload PUT, captions GET from the
// SWA origin). Keyless by contract (§5): shared-key access disabled — everything uses
// managed identity + user-delegation SAS.

@description('Globally-unique storage account name (3-24 lowercase alphanumerics)')
param storageAccountName string

@description('Azure region')
param location string

@description('Uploads container name (must match the VIDEOS_CONTAINER app setting)')
param videosContainerName string

@description('Results/diagnostics container name (must match RESULTS_CONTAINER)')
param resultsContainerName string

@description('Container holding the pipeline Flex Consumption deployment packages')
param deploymentsContainerName string

@description('Container receiving Event Grid dead-lettered events')
param deadLetterContainerName string

@description('SWA default hostname allowed by blob CORS (browser uploads + caption fetches)')
param swaHostname string

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    // Zero data-plane secrets (§5): no account keys, ever. SAS is user-delegation only.
    allowSharedKeyAccess: false
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          // Browser PUTs upload blocks directly via SAS; the watch page fetches
          // transcript.vtt as a <track> (CORS-enforced by browsers).
          allowedOrigins: ['https://${swaHostname}']
          allowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource videosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: videosContainerName
}

resource resultsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: resultsContainerName
}

resource deploymentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: deploymentsContainerName
}

resource deadLetterContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: deadLetterContainerName
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
