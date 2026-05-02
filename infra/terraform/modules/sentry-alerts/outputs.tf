output "alert_ids" { value = { for key, alert in sentry_issue_alert.high_error_count : key => alert.id } }
