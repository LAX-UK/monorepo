resource "sentry_integration_pagerduty" "primary" {
  count = var.enable_pagerduty ? 1 : 0

  organization    = var.organization_slug
  integration_id  = var.pagerduty_integration_id
  service         = var.pagerduty_service_name
  integration_key = var.pagerduty_integration_key
}

locals {
  slack_action = {
    slack_notify_service = {
      workspace  = var.slack_integration_id
      channel    = var.slack_channel
      channel_id = var.slack_channel_id
      tags       = ["environment", "level", "release"]
    }
  }

  email_action = {
    notify_email = {
      target_type       = "Team"
      target_identifier = var.team_internal_id
      fallthrough_type  = "AllMembers"
    }
  }

  pagerduty_action = var.enable_pagerduty ? {
    pagerduty_notify_service = {
      account  = sentry_integration_pagerduty.primary[0].integration_id
      service  = sentry_integration_pagerduty.primary[0].id
      severity = "critical"
    }
  } : {}

  warning_actions = var.enable_slack ? [local.slack_action] : [local.email_action]

  critical_actions = concat(
    var.enable_slack ? [local.slack_action] : [],
    var.enable_pagerduty ? [local.pagerduty_action] : [],
    [local.email_action],
  )
}
