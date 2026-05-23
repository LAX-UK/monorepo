resource "sentry_issue_alert" "new_issue_high_severity" {
  organization = var.organization_slug
  project      = var.project_slug
  name         = "New high-severity issue"
  action_match = "all"
  filter_match = "all"
  frequency    = 30

  conditions_v2 = [
    { first_seen_event = {} },
  ]

  filters_v2 = [
    {
      level = {
        match = "GREATER_OR_EQUAL"
        level = "error"
      }
    },
  ]

  actions_v2 = var.critical_actions_v2
}

resource "sentry_issue_alert" "regression" {
  organization = var.organization_slug
  project      = var.project_slug
  name         = "Issue regression"
  action_match = "all"
  filter_match = "all"
  frequency    = 60

  conditions_v2 = [
    { regression_event = {} },
  ]

  actions_v2 = var.warning_actions_v2
}
