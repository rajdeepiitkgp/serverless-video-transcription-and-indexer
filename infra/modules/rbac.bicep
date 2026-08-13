// Plan §3/§5: all role assignments (except VI→storage, which lives in
// video-indexer.bicep). System-assigned identities everywhere; assignments are
// idempotent guid()-named and carry explicit principalType to avoid AAD replication
// races on freshly-created identities.
//
// Storage Blob Data Contributor includes generateUserDelegationKey, which is what
// both apps use to mint user-delegation SAS (shared-key access is disabled).

@description('Storage account name (SAS + blob read/write scope)')
param storageAccountName string

@description('Cosmos account name (data-plane role assignments)')
param cosmosAccountName string

@description('Video Indexer ARM account name (generateAccessToken scope)')
param viAccountName string

@description('Custom Event Grid topic name (publish scope)')
param customTopicName string

@description('webapi Function App principal id')
param webApiPrincipalId string

@description('Pipeline Function App principal id')
param pipelinePrincipalId string

@description('System topic identity principal id (dead-letter writes)')
param systemTopicPrincipalId string

@description('Custom topic identity principal id (dead-letter writes)')
param customTopicPrincipalId string

var storageBlobDataContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
)
var eventGridDataSenderRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'd5a91429-5739-47e2-a06b-3470a27159e7'
)
var contributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b24988ac-6180-42a0-ab88-20f7382dd24c'
)
// Cosmos DB Built-in Data Contributor (data-plane, not an ARM role)
var cosmosDataContributorDefinitionId = resourceId(
  'Microsoft.DocumentDB/databaseAccounts/sqlRoleDefinitions',
  cosmosAccountName,
  '00000000-0000-0000-0000-000000000002'
)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

resource viAccount 'Microsoft.VideoIndexer/accounts@2024-01-01' existing = {
  name: viAccountName
}

resource customTopic 'Microsoft.EventGrid/topics@2022-06-15' existing = {
  name: customTopicName
}

// --- Storage: Blob Data Contributor ---

var blobContributorPrincipals = [
  webApiPrincipalId // upload/playback/download SAS, results reads (§5)
  pipelinePrincipalId // read-SAS for VI submit, results + diagnostics writes (§5)
  systemTopicPrincipalId // identity-based dead-letter writes
  customTopicPrincipalId // identity-based dead-letter writes
]

resource blobRoles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for principalId in blobContributorPrincipals: {
    name: guid(storageAccount.id, principalId, storageBlobDataContributorRoleId)
    scope: storageAccount
    properties: {
      principalId: principalId
      roleDefinitionId: storageBlobDataContributorRoleId
      principalType: 'ServicePrincipal'
    }
  }
]

// --- Cosmos: data-plane Data Contributor (sequential — concurrent sqlRoleAssignment
// PUTs on one account fail with "operation in progress") ---

resource webApiCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, webApiPrincipalId, 'data-contributor')
  properties: {
    principalId: webApiPrincipalId
    roleDefinitionId: cosmosDataContributorDefinitionId
    scope: cosmosAccount.id
  }
}

resource pipelineCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, pipelinePrincipalId, 'data-contributor')
  properties: {
    principalId: pipelinePrincipalId
    roleDefinitionId: cosmosDataContributorDefinitionId
    scope: cosmosAccount.id
  }
  dependsOn: [webApiCosmosRole]
}

// --- Event Grid: pipeline publishes to the custom topic with its identity ---

resource pipelineTopicSender 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(customTopic.id, pipelinePrincipalId, eventGridDataSenderRoleId)
  scope: customTopic
  properties: {
    principalId: pipelinePrincipalId
    roleDefinitionId: eventGridDataSenderRoleId
    principalType: 'ServicePrincipal'
  }
}

// --- Video Indexer: Contributor for ARM generateAccessToken (§2 flow note 2) ---

resource pipelineViContributor 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(viAccount.id, pipelinePrincipalId, contributorRoleId)
  scope: viAccount
  properties: {
    principalId: pipelinePrincipalId
    roleDefinitionId: contributorRoleId
    principalType: 'ServicePrincipal'
  }
}
