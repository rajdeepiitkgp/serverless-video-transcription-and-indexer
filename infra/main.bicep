// Plan §8: subscription-scope entry point — creates the resource group and everything
// in it. One command deploys; one `az group delete` destroys. Naming is
// {project}-{env}-{resource} with a uniqueString suffix on globally-unique names, so
// the same inputs produce the same names on recreate (bump resourceSuffix if a global
// name is stuck in reservation lag after a teardown).
//
// Two-phase deploy (§8): phase 1 with deployEventSubscriptions=false provisions
// everything except Event Grid subscriptions; after function code deploys, phase 2
// re-runs with deployEventSubscriptions=true (+ viCallbackUrl carrying the fetched
// IndexingCallback function key) to create the subscriptions and wire the VI callback.

targetScope = 'subscription'

@description('Short project slug used in every resource name (GitHub var PROJECT_NAME)')
param projectName string = 'vidx'

@description('Environment slug used in every resource name')
param envName string = 'prod'

@description('Azure region for all resources (AZURE_LOCATION)')
param location string

@description('Region for the Static Web App only — SWA is deployable to a short region list (centralus/eastus2/westus2/westeurope/eastasia) that excludes eastus; the app itself is globally distributed, so this is metadata placement, and cross-region backend linking is supported')
param staticWebAppLocation string = 'eastus2'

@description('Resource group name (AZURE_RESOURCE_GROUP)')
param resourceGroupName string

@description('Extra seed for globally-unique names — bump on name-reservation lag after teardown (RESOURCE_SUFFIX)')
param resourceSuffix string = '01'

@description('Monthly budget in USD (BUDGET_AMOUNT). Floor ~25: the B1 webapi plan alone runs ~$13/month (ADR-0003)')
param budgetAmount int = 25

@description('Email for budget + monitoring alerts (BUDGET_ALERT_EMAIL)')
param budgetAlertEmail string

@description('Discord webhook URL — the only data-plane secret in the system (§5)')
@secure()
param discordWebhookUrl string

@description('Phase 2 switch: deploy Event Grid subscriptions (only after function code is deployed)')
param deployEventSubscriptions bool = false

@description('Phase 2: full IndexingCallback URL including its function key (fetched at deploy time, never stored — §8 teardown table)')
@secure()
param viCallbackUrl string = ''

@description('Optional VI ARM api-version override (VI_ARM_API_VERSION escape hatch, §14); empty omits the app setting')
param viArmApiVersion string = ''

@description('Availability probe frequency in seconds (§8 — kept cheap)')
param availabilityTestFrequencySeconds int = 900

@description('Availability probe location ids (one by default — kept cheap)')
param availabilityTestLocations array = ['us-va-ash-azr']

@description('Log Analytics daily ingestion cap in GB, as a string (fractional)')
param logAnalyticsDailyCapGb string = '0.2'

// Container names are the single source the app-setting values point at; the code
// defaults (videos/results, VideoAnalytics/VideoMetadata) must keep matching them.
var videosContainerName = 'videos'
var resultsContainerName = 'results'
var deploymentsContainerName = 'deployments'
var deadLetterContainerName = 'eventgrid-deadletter'
var cosmosDatabaseName = 'VideoAnalytics'
var cosmosContainerName = 'VideoMetadata'

var suffix = uniqueString(subscription().id, resourceGroupName, resourceSuffix)
var prefix = '${projectName}-${envName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: {
    project: projectName
    environment: envName
    managedBy: 'bicep'
  }
}

// SWA first: storage CORS needs its generated hostname, webapi links to it.
module staticWebApp 'modules/static-web-app.bicep' = {
  name: 'static-web-app'
  scope: rg
  params: {
    swaName: '${prefix}-web-${suffix}'
    location: staticWebAppLocation
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  scope: rg
  params: {
    storageAccountName: toLower(take('${projectName}${envName}st${suffix}', 24))
    location: location
    videosContainerName: videosContainerName
    resultsContainerName: resultsContainerName
    deploymentsContainerName: deploymentsContainerName
    deadLetterContainerName: deadLetterContainerName
    swaHostname: staticWebApp.outputs.defaultHostname
  }
}

module cosmos 'modules/cosmos.bicep' = {
  name: 'cosmos'
  scope: rg
  params: {
    cosmosAccountName: toLower('${prefix}-cosmos-${suffix}')
    location: location
    databaseName: cosmosDatabaseName
    containerName: cosmosContainerName
  }
}

module videoIndexer 'modules/video-indexer.bicep' = {
  name: 'video-indexer'
  scope: rg
  params: {
    viAccountName: '${prefix}-vi-${suffix}'
    location: location
    storageAccountId: storage.outputs.storageAccountId
    storageAccountName: storage.outputs.storageAccountName
  }
}

var pipelineAppName = '${prefix}-pipeline-${suffix}'

module eventGrid 'modules/event-grid.bicep' = {
  name: 'event-grid'
  scope: rg
  params: {
    systemTopicName: '${prefix}-egst-blob'
    customTopicName: '${prefix}-egt-${suffix}'
    location: location
    storageAccountId: storage.outputs.storageAccountId
    videosContainerName: videosContainerName
    deadLetterContainerName: deadLetterContainerName
    pipelineAppName: pipelineAppName
    deploySubscriptions: deployEventSubscriptions
  }
}

module pipelineApp 'modules/pipeline-app.bicep' = {
  name: 'pipeline-app'
  scope: rg
  params: {
    logAnalyticsName: '${prefix}-logs'
    appInsightsName: '${prefix}-appi'
    planName: '${prefix}-plan-pipeline'
    appName: pipelineAppName
    location: location
    dailyCapGb: logAnalyticsDailyCapGb
    storageAccountName: storage.outputs.storageAccountName
    blobEndpoint: storage.outputs.blobEndpoint
    deploymentsContainerName: deploymentsContainerName
    videosContainerName: videosContainerName
    resultsContainerName: resultsContainerName
    cosmosEndpoint: cosmos.outputs.documentEndpoint
    cosmosDatabaseName: cosmosDatabaseName
    cosmosContainerName: cosmosContainerName
    eventGridTopicEndpoint: eventGrid.outputs.customTopicEndpoint
    viResourceGroupName: resourceGroupName
    viAccountName: videoIndexer.outputs.viAccountName
    viAccountId: videoIndexer.outputs.viAccountId
    viLocation: videoIndexer.outputs.viLocation
    viCallbackUrl: viCallbackUrl
    viArmApiVersion: viArmApiVersion
    discordWebhookUrl: discordWebhookUrl
    swaHostname: staticWebApp.outputs.defaultHostname
  }
}

module webApiApp 'modules/webapi-app.bicep' = {
  name: 'webapi-app'
  scope: rg
  params: {
    planName: '${prefix}-plan-api'
    appName: '${prefix}-api-${suffix}'
    location: location
    storageAccountName: storage.outputs.storageAccountName
    blobEndpoint: storage.outputs.blobEndpoint
    videosContainerName: videosContainerName
    resultsContainerName: resultsContainerName
    cosmosEndpoint: cosmos.outputs.documentEndpoint
    cosmosDatabaseName: cosmosDatabaseName
    cosmosContainerName: cosmosContainerName
    appInsightsConnectionString: pipelineApp.outputs.appInsightsConnectionString
    swaName: staticWebApp.outputs.swaName
  }
}

module rbac 'modules/rbac.bicep' = {
  name: 'rbac'
  scope: rg
  params: {
    storageAccountName: storage.outputs.storageAccountName
    cosmosAccountName: cosmos.outputs.cosmosAccountName
    viAccountName: videoIndexer.outputs.viAccountName
    customTopicName: eventGrid.outputs.customTopicName
    webApiPrincipalId: webApiApp.outputs.webApiAppPrincipalId
    pipelinePrincipalId: pipelineApp.outputs.pipelineAppPrincipalId
    systemTopicPrincipalId: eventGrid.outputs.systemTopicPrincipalId
    customTopicPrincipalId: eventGrid.outputs.customTopicPrincipalId
  }
}

module alerts 'modules/alerts.bicep' = {
  name: 'alerts'
  scope: rg
  params: {
    actionGroupName: '${prefix}-ag'
    actionGroupShortName: take('${projectName}-alerts', 12)
    alertEmail: budgetAlertEmail
    webTestName: '${prefix}-availability'
    location: location
    appInsightsId: pipelineApp.outputs.appInsightsId
    swaHostname: staticWebApp.outputs.defaultHostname
    testFrequencySeconds: availabilityTestFrequencySeconds
    testLocations: availabilityTestLocations
    pipelineAppName: pipelineApp.outputs.pipelineAppName
    systemTopicId: eventGrid.outputs.systemTopicId
    customTopicId: eventGrid.outputs.customTopicId
  }
}

module budget 'modules/budget.bicep' = {
  name: 'budget'
  scope: rg
  params: {
    budgetName: '${prefix}-budget'
    amount: budgetAmount
    alertEmail: budgetAlertEmail
  }
}

// Consumed by the M6 deploy workflows (SWA deploy, functions deploys, web build env,
// phase-2 callback key fetch) and the smoke test.
output resourceGroupName string = rg.name
output staticWebAppName string = staticWebApp.outputs.swaName
output staticWebAppHostname string = staticWebApp.outputs.defaultHostname
output webApiAppName string = webApiApp.outputs.webApiAppName
output pipelineAppName string = pipelineApp.outputs.pipelineAppName
output storageAccountName string = storage.outputs.storageAccountName
output cosmosAccountName string = cosmos.outputs.cosmosAccountName
output videoIndexerAccountName string = videoIndexer.outputs.viAccountName
output appInsightsConnectionString string = pipelineApp.outputs.appInsightsConnectionString
