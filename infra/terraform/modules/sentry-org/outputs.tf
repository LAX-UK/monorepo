output "team_slug" {
  description = "Engineering team slug."
  value       = data.sentry_team.engineering.slug
}

output "team_internal_id" {
  description = "Engineering team internal ID (for email alert targets)."
  value       = data.sentry_team.engineering.internal_id
}

output "github_integration_id" {
  description = "GitHub organization integration ID (empty when enable_github is false)."
  value       = var.enable_github ? var.github_integration_id : ""
}

output "slack_integration_id" {
  description = "Slack workspace integration ID (empty when enable_slack is false)."
  value       = var.enable_slack ? data.sentry_organization_integration.slack[0].id : ""
}

output "pagerduty_integration_id" {
  description = "PagerDuty organization integration ID (empty when enable_pagerduty is false)."
  value       = var.enable_pagerduty ? data.sentry_organization_integration.pagerduty[0].id : ""
}

output "github_repository_id" {
  description = "Sentry organization repository ID for GitHub (empty when enable_github is false)."
  value       = try(sentry_organization_repository.github[0].id, "")
}
