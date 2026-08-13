// Plan §8: SWA Standard — the tier that allows linking a standalone Function App as
// an exclusive backend (the link itself lives in webapi-app.bicep, which depends on
// this SWA). No repository wiring: deploys use the SWA CLI/action with a deploy token
// fetched at deploy time (`az staticwebapp secrets list`), never stored (§8 teardown).

@description('Static Web App name')
param swaName string

@description('Azure region')
param location string

@description('SWA application settings. The static export needs none at runtime (no managed functions); kept parameterized per plan §3.')
param appSettings object = {}

resource staticWebApp 'Microsoft.Web/staticSites@2024-04-01' = {
  name: swaName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    // staticwebapp.config.json in the deployed artifact controls auth/routes.
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
    provider: 'None'
  }
}

resource swaAppSettings 'Microsoft.Web/staticSites/config@2024-04-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: appSettings
}

output swaId string = staticWebApp.id
output swaName string = staticWebApp.name
output defaultHostname string = staticWebApp.properties.defaultHostname
