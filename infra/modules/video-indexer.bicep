// Plan §2 deviation 1: ARM Video Indexer account (`Microsoft.VideoIndexer/accounts`)
// with system-assigned identity — key-based/classic VI auth is deprecated. The VI
// identity gets Storage Blob Data Contributor on the media storage account here
// (plan §3 puts this specific role assignment in this module, the rest in rbac.bicep).

@description('Video Indexer account name')
param viAccountName string

@description('Azure region')
param location string

@description('Resource id of the storage account VI reads media from')
param storageAccountId string

@description('Name of that storage account (for the role-assignment scope)')
param storageAccountName string

// Storage Blob Data Contributor
var storageBlobDataContributorRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
)

resource viAccount 'Microsoft.VideoIndexer/accounts@2024-01-01' = {
  name: viAccountName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    storageServices: {
      resourceId: storageAccountId
    }
  }
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource viStorageRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccountId, viAccount.id, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    principalId: viAccount.identity.principalId
    roleDefinitionId: storageBlobDataContributorRoleId
    // Explicit principalType avoids AAD replication races on fresh identities (§5).
    principalType: 'ServicePrincipal'
  }
}

output viAccountArmId string = viAccount.id
output viAccountName string = viAccount.name
// The VI data-plane GUID — distinct from the ARM resource name; the pipeline needs both.
output viAccountId string = viAccount.properties.accountId
output viLocation string = viAccount.location
