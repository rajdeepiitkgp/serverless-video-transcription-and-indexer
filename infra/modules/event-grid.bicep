// Plan §2/§8: Blob-created system topic + custom video-indexing topic (phase 1), and
// the event subscriptions targeting the pipeline functions (phase 2 only — ARM
// validates the target function exists, so subscriptions can't precede code on a
// fresh stack). The pipeline app name arrives as a plain string (not a module output)
// precisely so this module never depends on pipeline-app.bicep — pipeline-app consumes
// this module's topic endpoint, and a cycle would otherwise form.

@description('System topic name (Microsoft.Storage.BlobCreated source)')
param systemTopicName string

@description('Custom topic name (video-indexing events; globally-unique DNS)')
param customTopicName string

@description('Azure region')
param location string

@description('Resource id of the storage account the system topic watches')
param storageAccountId string

@description('Uploads container name for the BlobCreated subject filter')
param videosContainerName string

@description('Container receiving dead-lettered events (in the same storage account)')
param deadLetterContainerName string

@description('Pipeline Function App name — used to construct function resource ids for phase-2 subscriptions')
param pipelineAppName string

@description('Phase 2 switch: create the event subscriptions (requires deployed function code)')
param deploySubscriptions bool

resource systemTopic 'Microsoft.EventGrid/systemTopics@2022-06-15' = {
  name: systemTopicName
  location: location
  identity: {
    type: 'SystemAssigned' // used for identity-based dead-lettering (keyless, §5)
  }
  properties: {
    source: storageAccountId
    topicType: 'Microsoft.Storage.StorageAccounts'
  }
}

resource customTopic 'Microsoft.EventGrid/topics@2022-06-15' = {
  name: customTopicName
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    inputSchema: 'EventGridSchema'
    publicNetworkAccess: 'Enabled'
    // Zero data-plane secrets (§5): no SAS keys — the pipeline publishes with its
    // managed identity (EventGrid Data Sender, assigned in rbac.bicep).
    disableLocalAuth: true
  }
}

var deadLetterDestination = {
  endpointType: 'StorageBlob'
  properties: {
    resourceId: storageAccountId
    blobContainerName: deadLetterContainerName
  }
}

resource blobCreatedSubscription 'Microsoft.EventGrid/systemTopics/eventSubscriptions@2022-06-15' = if (deploySubscriptions) {
  parent: systemTopic
  name: 'process-video-upload'
  properties: {
    destination: {
      endpointType: 'AzureFunction'
      properties: {
        resourceId: resourceId('Microsoft.Web/sites/functions', pipelineAppName, 'ProcessVideoUpload')
        maxEventsPerBatch: 1
      }
    }
    filter: {
      includedEventTypes: ['Microsoft.Storage.BlobCreated']
      subjectBeginsWith: '/blobServices/default/containers/${videosContainerName}/'
      // Only completed uploads (§2 flow note 2), not intermediate block puts.
      advancedFilters: [
        {
          operatorType: 'StringIn'
          key: 'data.api'
          values: ['PutBlob', 'PutBlockList']
        }
      ]
    }
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440
    }
    deadLetterWithResourceIdentity: {
      identity: { type: 'SystemAssigned' }
      deadLetterDestination: deadLetterDestination
    }
  }
}

resource indexingCompletedSubscription 'Microsoft.EventGrid/topics/eventSubscriptions@2022-06-15' = if (deploySubscriptions) {
  parent: customTopic
  name: 'process-video-results'
  properties: {
    destination: {
      endpointType: 'AzureFunction'
      properties: {
        resourceId: resourceId('Microsoft.Web/sites/functions', pipelineAppName, 'ProcessVideoResults')
        maxEventsPerBatch: 1
      }
    }
    filter: {
      // Exact event type published by handle-indexing-callback (packages/shared
      // VIDEO_INDEXING_COMPLETED_EVENT_TYPE) — carries both Processed and Failed states.
      includedEventTypes: ['VideoIndexing.Completed']
    }
    retryPolicy: {
      maxDeliveryAttempts: 30
      eventTimeToLiveInMinutes: 1440
    }
    deadLetterWithResourceIdentity: {
      identity: { type: 'SystemAssigned' }
      deadLetterDestination: deadLetterDestination
    }
  }
}

output systemTopicName string = systemTopic.name
output systemTopicId string = systemTopic.id
output systemTopicPrincipalId string = systemTopic.identity.principalId
output customTopicName string = customTopic.name
output customTopicId string = customTopic.id
output customTopicPrincipalId string = customTopic.identity.principalId
output customTopicEndpoint string = customTopic.properties.endpoint
