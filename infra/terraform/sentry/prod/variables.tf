variable "sentry_auth_token" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Sentry internal integration token. Empty skips all resources."
}

variable "sentry_organization_slug" {
  type        = string
  default     = "lax"
  description = "Sentry organization slug."
}

variable "sentry_team_slug" {
  type        = string
  default     = "lax-engineering"
  description = "Sentry team slug."
}

variable "github_integration_name" {
  type        = string
  default     = "GitHub"
  description = "GitHub integration display name in Sentry."
}

variable "slack_integration_name" {
  type        = string
  default     = "Slack"
  description = "Slack integration display name in Sentry."
}

variable "pagerduty_integration_name" {
  type        = string
  default     = "PagerDuty"
  description = "PagerDuty integration display name in Sentry."
}

variable "github_repository_identifier" {
  type        = string
  default     = "LAX-UK/monorepo"
  description = "GitHub org/repo linked in Sentry."
}

variable "slack_channel" {
  type        = string
  default     = "#alerts-engineering"
  description = "Slack channel for alert notifications."
}

variable "slack_channel_id" {
  type        = string
  default     = ""
  description = "Slack channel ID (C…). Optional — leave empty to skip Slack/PagerDuty alerts until later; projects and DSNs still apply."
}

variable "pagerduty_service_name" {
  type        = string
  default     = "lax-primary"
  description = "PagerDuty service name in Sentry."
}

variable "pagerduty_integration_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "PagerDuty Events API integration key."
}

variable "support_email" {
  type        = string
  default     = "support@lax.bid"
  description = "Support inbox for critical alerts."
}
