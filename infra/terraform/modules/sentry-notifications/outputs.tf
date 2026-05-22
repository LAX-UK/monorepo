output "warning_actions_v2" {
  description = "actions_v2 list for warning-severity alerts."
  value       = local.warning_actions
}

output "critical_actions_v2" {
  description = "actions_v2 list for critical-severity alerts."
  value       = local.critical_actions
}

output "slack_integration_id" {
  description = "Slack integration ID (for metric alert triggers)."
  value       = var.slack_integration_id
}

output "slack_channel_id" {
  description = "Slack channel ID (for metric alert triggers)."
  value       = var.slack_channel_id
}

output "pagerduty_service_id" {
  description = "PagerDuty service ID in Sentry (empty when disabled)."
  value       = var.enable_pagerduty ? sentry_integration_pagerduty.primary[0].id : ""
}

output "pagerduty_integration_id" {
  description = "PagerDuty integration ID in Sentry (empty when disabled)."
  value       = var.enable_pagerduty ? sentry_integration_pagerduty.primary[0].integration_id : ""
}

output "team_internal_id" {
  description = "Team internal ID for email metric alert actions."
  value       = var.team_internal_id
}
