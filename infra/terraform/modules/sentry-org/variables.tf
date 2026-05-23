variable "organization_slug" {
  type        = string
  description = "Sentry organization slug."
}

variable "team_slug" {
  type        = string
  description = "Existing Sentry team slug that owns projects."
}

variable "github_integration_id" {
  type        = string
  default     = ""
  description = "GitHub org integration ID from Sentry (Settings → Integrations → GitHub). Internal integration tokens cannot list integrations via API — set this explicitly."
}

variable "enable_github" {
  type        = bool
  default     = false
  description = "Link LAX-UK/monorepo and enable code mappings. Requires github_integration_id."
}

variable "github_repository_identifier" {
  type        = string
  description = "GitHub repo identifier for code mappings (org/repo)."
}

variable "slack_integration_name" {
  type        = string
  description = "Display name of the Slack workspace integration in Sentry."
}

variable "pagerduty_integration_name" {
  type        = string
  description = "Display name of the PagerDuty integration in Sentry."
}

variable "enable_slack" {
  type        = bool
  description = "Look up the Slack integration. Set false until SENTRY_SLACK_CHANNEL_ID is configured."
  default     = false
}

variable "enable_pagerduty" {
  type        = bool
  description = "Look up the PagerDuty integration. Set false until PAGERDUTY_INTEGRATION_KEY is configured."
  default     = false
}
