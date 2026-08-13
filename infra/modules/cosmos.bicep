// Plan §3/§5: Cosmos DB serverless + VideoAnalytics/VideoMetadata. Provisioning here
// IS the initial migration — schemaless, idempotent on every redeploy, no seed data.
// Keyless by contract: local (key) auth disabled; data-plane access is AAD RBAC only.

@description('Globally-unique Cosmos DB account name')
param cosmosAccountName string

@description('Azure region')
param location string

@description('Database name (must match the COSMOS_DATABASE app setting default)')
param databaseName string

@description('Container name (must match COSMOS_CONTAINER)')
param containerName string

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    capabilities: [
      { name: 'EnableServerless' }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    minimalTlsVersion: 'Tls12'
    // Zero data-plane secrets (§5): master keys off; managed identity + RBAC only.
    disableLocalAuth: true
  }
}

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-11-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-11-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      // Partition key /id (§5) — cross-partition queries are fine at this scale.
      partitionKey: {
        paths: ['/id']
        kind: 'Hash'
        version: 2
      }
    }
  }
}

output cosmosAccountId string = cosmosAccount.id
output cosmosAccountName string = cosmosAccount.name
output documentEndpoint string = cosmosAccount.properties.documentEndpoint
