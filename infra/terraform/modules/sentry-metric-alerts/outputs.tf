output "error_rate_alert_id" {
  description = "Error rate metric alert ID."
  value       = sentry_metric_alert.error_rate_5m.id
}

output "transaction_p95_alert_id" {
  description = "Transaction P95 metric alert ID (empty when skipped)."
  value       = var.p95_ms != null ? sentry_metric_alert.transaction_p95_2xx[0].id : ""
}
