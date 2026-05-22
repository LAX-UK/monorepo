output "new_issue_alert_id" {
  description = "ID of the new high-severity issue alert."
  value       = sentry_issue_alert.new_issue_high_severity.id
}

output "regression_alert_id" {
  description = "ID of the regression issue alert."
  value       = sentry_issue_alert.regression.id
}
