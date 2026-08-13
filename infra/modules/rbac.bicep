// Plan §3/§5 as amended by ADR-0002: all role assignments (except VI→storage, which
// lives in video-indexer.bicep). System-assigned identities everywhere; assignments
// are idempotent guid()-named and carry explicit principalType to avoid AAD
// replication races on freshly-created identities.
//
// The function apps hold Storage Blob Data Owner — the documented minimum for the
// host's identity-based AzureWebJobsStorage connection, and a superset of the
// generateUserDelegationKey permission both apps use to mint user-delegation SAS
// (shared-key access is disabled). Queue + Table Data Contributor complete the
// documented host storage requirements (ADR-0002 — precautionary; shortfalls are
// reported to fail silently, though they were not this stack's outage cause).

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
var storageBlobDataOwnerRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
)
var storageQueueDataContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '974c5e8b-45b9-4653-ba55-5f855dd0fb88'
)
var storageTableDataContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3'
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

// --- Storage: function-app host roles (ADR-0002) ---
// Blob Data Owner (host minimum; also covers SAS minting + results/diagnostics
// blob I/O per §5), Queue Data Contributor (host initialization), Table Data
// Contributor (host diagnostic events).

var hostStorageAssignments = [
  { principalId: webApiPrincipalId, roleId: storageBlobDataOwnerRoleId }
  { principalId: webApiPrincipalId, roleId: storageQueueDataContributorRoleId }
  { principalId: webApiPrincipalId, roleId: storageTableDataContributorRoleId }
  { principalId: pipelinePrincipalId, roleId: storageBlobDataOwnerRoleId }
  { principalId: pipelinePrincipalId, roleId: storageQueueDataContributorRoleId }
  { principalId: pipelinePrincipalId, roleId: storageTableDataContributorRoleId }
]

resource hostStorageRoles 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for assignment in hostStorageAssignments: {
    name: guid(storageAccount.id, assignment.principalId, assignment.roleId)
    scope: storageAccount
    properties: {
      principalId: assignment.principalId
      roleDefinitionId: assignment.roleId
      principalType: 'ServicePrincipal'
    }
  }
]

// --- Storage: Blob Data Contributor (Event Grid dead-letter writes) ---

var blobContributorPrincipals = [
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

// The deploying principal seeds the smoke test's metadata document (ADR-0005) —
// in CI, deployer() is the OIDC principal that also runs `pnpm smoke`. Lives here
// rather than bootstrap because sqlRoleAssignments die with the account on destroy.
resource deployerCosmosRole 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, deployer().objectId, 'data-contributor')
  properties: {
    principalId: deployer().objectId
    roleDefinitionId: cosmosDataContributorDefinitionId
    scope: cosmosAccount.id
  }
  dependsOn: [pipelineCosmosRole]
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
