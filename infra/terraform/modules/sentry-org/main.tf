data "sentry_team" "engineering" {
  organization = var.organization_slug
  slug         = var.team_slug
}

data "sentry_organization_integration" "slack" {
  count = var.enable_slack ? 1 : 0

  organization = var.organization_slug
  provider_key = "slack"
  name         = var.slack_integration_name
}

data "sentry_organization_integration" "pagerduty" {
  count = var.enable_pagerduty ? 1 : 0

  organization = var.organization_slug
  provider_key = "pagerduty"
  name         = var.pagerduty_integration_name
}

resource "sentry_organization_repository" "github" {
  count = var.enable_github ? 1 : 0

  organization     = var.organization_slug
  integration_type = "github"
  integration_id   = var.github_integration_id
  identifier       = var.github_repository_identifier
}
