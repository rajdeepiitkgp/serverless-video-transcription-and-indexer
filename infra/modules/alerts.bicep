// Plan §8: Azure-native monitoring, all in the RG so it dies and is recreated with
// the stack. Availability test pings the anonymous /api/health through the SWA domain
// (one probe location, 15-minute frequency by default — both parameterized, billed
// per execution at cents-level). Metric alerts: availability failures, pipeline
// function failures, Event Grid dead-letters. One action group emails the owner.

@description('Action group name')
param actionGroupName string

@description('Action group short name (max 12 chars, shown in notifications)')
@maxLength(12)
param actionGroupShortName string

@description('Email address receiving every alert')
param alertEmail string

@description('Availability web test name')
param webTestName string

@description('Azure region (web tests must live in the App Insights region)')
param location string

@description('App Insights component id (webtest hidden-link + alert scopes)')
param appInsightsId string

@description('SWA default hostname — the availability test probes through the SWA domain, which also exercises the linked-backend proxy')
param swaHostname string

@description('Probe frequency in seconds')
param testFrequencySeconds int = 900

@description('Probe location ids (one by default — kept cheap)')
param testLocations array = ['us-va-ash-azr']

@description('Pipeline Function App name (cloud/roleName dimension on failure alerts)')
param pipelineAppName string

@description('System topic id (dead-letter metric scope)')
param systemTopicId string

@description('Custom topic id (dead-letter metric scope)')
param customTopicId string

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = {
  name: actionGroupName
  location: 'Global'
  properties: {
    groupShortName: actionGroupShortName
    enabled: true
    emailReceivers: [
      {
        name: 'owner'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource availabilityTest 'Microsoft.Insights/webtests@2022-06-15' = {
  name: webTestName
  location: location
  tags: {
    // Required marker tying the webtest to its App Insights component.
    'hidden-link:${appInsightsId}': 'Resource'
  }
  kind: 'standard'
  properties: {
    SyntheticMonitorId: webTestName
    Name: webTestName
    Kind: 'standard'
    Enabled: true
    Frequency: testFrequencySeconds
    Timeout: 30
    RetryEnabled: true
    Locations: [for loc in testLocations: { Id: loc }]
    Request: {
      RequestUrl: 'https://${swaHostname}/api/health'
      HttpVerb: 'GET'
      ParseDependentRequests: false
    }
    ValidationRules: {
      ExpectedHttpStatusCode: 200
      SSLCheck: false
    }
  }
}

resource availabilityAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${webTestName}-failed'
  location: 'global'
  properties: {
    description: 'The /api/health availability test is failing'
    severity: 1
    enabled: true
    scopes: [availabilityTest.id, appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.WebtestLocationAvailabilityCriteria'
      webTestId: availabilityTest.id
      componentId: appInsightsId
      failedLocationCount: 1
    }
    autoMitigate: true
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

resource pipelineFailureAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${pipelineAppName}-failures'
  location: 'global'
  properties: {
    description: 'Pipeline function executions are failing'
    severity: 2
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'pipeline-failed-requests'
          metricNamespace: 'microsoft.insights/components'
          metricName: 'requests/failed'
          dimensions: [
            {
              // Both apps share this App Insights instance (§6); scope to the pipeline.
              name: 'cloud/roleName'
              operator: 'Include'
              values: [pipelineAppName]
            }
          ]
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Count'
        }
      ]
    }
    autoMitigate: true
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

resource systemTopicDeadLetterAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${pipelineAppName}-blob-events-dead-lettered'
  location: 'global'
  properties: {
    description: 'BlobCreated events are being dead-lettered instead of delivered to ProcessVideoUpload'
    severity: 2
    enabled: true
    scopes: [systemTopicId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'dead-lettered'
          metricNamespace: 'Microsoft.EventGrid/systemTopics'
          metricName: 'DeadLetteredCount'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
        }
      ]
    }
    autoMitigate: true
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}

resource customTopicDeadLetterAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${pipelineAppName}-indexing-events-dead-lettered'
  location: 'global'
  properties: {
    description: 'VideoIndexing.Completed events are being dead-lettered instead of delivered to ProcessVideoResults'
    severity: 2
    enabled: true
    scopes: [customTopicId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          criterionType: 'StaticThresholdCriterion'
          name: 'dead-lettered'
          metricNamespace: 'Microsoft.EventGrid/topics'
          metricName: 'DeadLetteredCount'
          operator: 'GreaterThan'
          threshold: 0
          timeAggregation: 'Total'
        }
      ]
    }
    autoMitigate: true
    actions: [
      { actionGroupId: actionGroup.id }
    ]
  }
}
