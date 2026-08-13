// Plan §8: monthly RG budget (default $10, parameterized) alerting BUDGET_ALERT_EMAIL
// at 50% / 80% / 100% actual + 100% forecast. Deployed at resource-group scope so it
// dies (and is recreated) with the stack.

@description('Budget resource name')
param budgetName string

@description('Monthly budget amount in USD')
param amount int

@description('Email address notified at each threshold')
param alertEmail string

@description('First day of the current month (UTC) — budgets require a period start')
param startDate string = utcNow('yyyy-MM-01')

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
      endDate: dateTimeAdd(startDate, 'P10Y')
    }
    notifications: {
      actual50: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [alertEmail]
      }
      actual80: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        thresholdType: 'Actual'
        contactEmails: [alertEmail]
      }
      actual100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Actual'
        contactEmails: [alertEmail]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [alertEmail]
      }
    }
  }
}
