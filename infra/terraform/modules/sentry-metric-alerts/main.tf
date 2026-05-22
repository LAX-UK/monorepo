locals {
  slack_warning_action = {
    type              = "slack"
    target_type       = "specific"
    target_identifier = var.slack_channel
    input_channel_id  = var.slack_channel_id
    integration_id    = var.slack_integration_id
  }

  pagerduty_critical_action = var.pagerduty_service_id != "" ? {
    type              = "pagerduty"
    target_type       = "specific"
    target_identifier = var.pagerduty_service_id
    integration_id    = var.pagerduty_integration_id
  } : null

  email_critical_action = {
    type              = "email"
    target_type       = "team"
    target_identifier = var.team_internal_id
  }
}

resource "sentry_metric_alert" "error_rate_5m" {
  organization   = var.organization_slug
  project        = var.project_slug
  name           = "${var.app_key} error rate (5m)"
  dataset        = "events"
  event_types    = ["error"]
  query          = ""
  aggregate      = "count()"
  time_window    = 5
  threshold_type = 0

  trigger {
    label           = "warning"
    alert_threshold = 5
    threshold_type  = 0
    action {
      type              = local.slack_warning_action.type
      target_type       = local.slack_warning_action.target_type
      target_identifier = local.slack_warning_action.target_identifier
      input_channel_id  = local.slack_warning_action.input_channel_id
      integration_id    = local.slack_warning_action.integration_id
    }
  }

  trigger {
    label           = "critical"
    alert_threshold = 20
    threshold_type  = 0
    dynamic "action" {
      for_each = local.pagerduty_critical_action != null ? [local.pagerduty_critical_action] : []
      content {
        type              = action.value.type
        target_type       = action.value.target_type
        target_identifier = action.value.target_identifier
        integration_id    = action.value.integration_id
      }
    }
    action {
      type              = local.slack_warning_action.type
      target_type       = local.slack_warning_action.target_type
      target_identifier = local.slack_warning_action.target_identifier
      input_channel_id  = local.slack_warning_action.input_channel_id
      integration_id    = local.slack_warning_action.integration_id
    }
  }
}

resource "sentry_metric_alert" "transaction_p95_2xx" {
  count = var.p95_ms != null ? 1 : 0

  organization   = var.organization_slug
  project        = var.project_slug
  name           = "${var.app_key} transaction p95 (10m)"
  dataset        = "transactions"
  event_types    = ["transaction"]
  query          = "transaction.status:ok"
  aggregate      = "p95(transaction.duration)"
  time_window    = 10
  threshold_type = 0

  trigger {
    label           = "warning"
    alert_threshold = var.p95_ms
    threshold_type  = 0
    action {
      type              = local.slack_warning_action.type
      target_type       = local.slack_warning_action.target_type
      target_identifier = local.slack_warning_action.target_identifier
      input_channel_id  = local.slack_warning_action.input_channel_id
      integration_id    = local.slack_warning_action.integration_id
    }
  }
}

resource "sentry_metric_alert" "money_path_5xx" {
  count = var.enable_money_path_alerts ? 1 : 0

  organization   = var.organization_slug
  project        = var.project_slug
  name           = "Stripe webhook errors (5m)"
  dataset        = "events"
  event_types    = ["error"]
  query          = "transaction:/webhooks/stripe/*"
  aggregate      = "count()"
  time_window    = 5
  threshold_type = 0

  trigger {
    label           = "critical"
    alert_threshold = 1
    threshold_type  = 0
    dynamic "action" {
      for_each = local.pagerduty_critical_action != null ? [local.pagerduty_critical_action] : []
      content {
        type              = action.value.type
        target_type       = action.value.target_type
        target_identifier = action.value.target_identifier
        integration_id    = action.value.integration_id
      }
    }
    action {
      type              = local.email_critical_action.type
      target_type       = local.email_critical_action.target_type
      target_identifier = local.email_critical_action.target_identifier
    }
  }
}

resource "sentry_metric_alert" "payout_failures" {
  count = var.enable_money_path_alerts ? 1 : 0

  organization   = var.organization_slug
  project        = var.project_slug
  name           = "Payout reconciliation failures (5m)"
  dataset        = "events"
  event_types    = ["error"]
  query          = "event.type:error tag:event_type:payout_reconciled_failed"
  aggregate      = "count()"
  time_window    = 5
  threshold_type = 0

  trigger {
    label           = "critical"
    alert_threshold = 1
    threshold_type  = 0
    dynamic "action" {
      for_each = local.pagerduty_critical_action != null ? [local.pagerduty_critical_action] : []
      content {
        type              = action.value.type
        target_type       = action.value.target_type
        target_identifier = action.value.target_identifier
        integration_id    = action.value.integration_id
      }
    }
    action {
      type              = local.email_critical_action.type
      target_type       = local.email_critical_action.target_type
      target_identifier = local.email_critical_action.target_identifier
    }
  }
}
