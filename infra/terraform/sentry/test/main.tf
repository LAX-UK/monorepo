locals {
  environment = "test"
  # Token presence is safe to expose for count/for_each gating; the token itself stays sensitive.
  enabled          = nonsensitive(trimspace(var.sentry_auth_token) != "")
  enable_slack     = var.slack_channel_id != ""
  enable_pagerduty = false
  enable_alerts    = local.enable_slack
  enable_github    = trimspace(var.github_integration_id) != ""
}

module "catalog" {
  source = "../_shared"
}

module "org" {
  count  = local.enabled ? 1 : 0
  source = "../../modules/sentry-org"

  organization_slug            = var.sentry_organization_slug
  team_slug                    = var.sentry_team_slug
  github_integration_id        = var.github_integration_id
  enable_github                = local.enable_github
  slack_integration_name       = var.slack_integration_name
  pagerduty_integration_name   = var.pagerduty_integration_name
  github_repository_identifier = var.github_repository_identifier
  enable_slack                 = local.enable_slack
  enable_pagerduty             = local.enable_pagerduty
}

module "notifications" {
  count  = local.enabled && local.enable_alerts ? 1 : 0
  source = "../../modules/sentry-notifications"

  organization_slug         = var.sentry_organization_slug
  slack_integration_id      = module.org[0].slack_integration_id
  pagerduty_integration_id  = module.org[0].pagerduty_integration_id
  slack_channel             = var.slack_channel
  slack_channel_id          = var.slack_channel_id
  pagerduty_service_name    = var.pagerduty_service_name
  pagerduty_integration_key = var.pagerduty_integration_key
  support_email             = var.support_email
  team_internal_id          = module.org[0].team_internal_id
  enable_slack              = local.enable_slack
  enable_pagerduty          = local.enable_pagerduty
}

module "app_projects" {
  for_each = local.enabled ? module.catalog.apps : {}
  source   = "../../modules/sentry-app-project"

  organization_slug     = var.sentry_organization_slug
  team_slug             = module.org[0].team_slug
  app_key               = each.key
  project_name          = "lax-${local.environment}-${each.key}"
  platform              = each.value.platform
  github_integration_id = module.org[0].github_integration_id
  github_repository_id  = module.org[0].github_repository_id
  enable_code_mappings  = local.enable_github
  inbound_filters       = module.catalog.inbound_filters
}

module "issue_alerts" {
  for_each = local.enabled && local.enable_alerts ? module.catalog.apps : {}
  source   = "../../modules/sentry-issue-alerts"

  organization_slug   = var.sentry_organization_slug
  project_slug        = module.app_projects[each.key].project_slug
  warning_actions_v2  = module.notifications[0].warning_actions_v2
  critical_actions_v2 = module.notifications[0].critical_actions_v2
}

module "metric_alerts" {
  for_each = local.enabled && local.enable_alerts ? module.catalog.apps : {}
  source   = "../../modules/sentry-metric-alerts"

  organization_slug        = var.sentry_organization_slug
  project_slug             = module.app_projects[each.key].project_slug
  app_key                  = each.key
  p95_ms                   = each.value.p95_ms
  enable_money_path_alerts = each.key == "api"
  slack_integration_id     = module.notifications[0].slack_integration_id
  slack_channel_id         = module.notifications[0].slack_channel_id
  pagerduty_integration_id = module.notifications[0].pagerduty_integration_id
  pagerduty_service_id     = module.notifications[0].pagerduty_service_id
  team_internal_id         = module.notifications[0].team_internal_id
  enable_slack             = local.enable_slack
  slack_channel            = var.slack_channel
}

module "worker_crons" {
  count  = local.enabled ? 1 : 0
  source = "../../modules/sentry-cron-monitors"

  environment  = local.environment
  worker_crons = module.catalog.worker_crons
}
