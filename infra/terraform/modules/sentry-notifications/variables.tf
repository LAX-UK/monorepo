variable "organization_slug" {
  type        = string
  description = "Sentry organization slug."
}

variable "slack_integration_id" {
  type        = string
  description = "Slack workspace integration ID."
}

variable "pagerduty_integration_id" {
  type        = string
  description = "PagerDuty organization integration ID."
}

variable "slack_channel" {
  type        = string
  description = "Slack channel name (e.g. #alerts-engineering)."
}

variable "slack_channel_id" {
  type        = string
  description = "Slack channel ID for metric alert actions."
}

variable "pagerduty_service_name" {
  type        = string
  description = "PagerDuty service name registered in Sentry."
}

variable "pagerduty_integration_key" {
  type        = string
  description = "PagerDuty Events API integration key."
  sensitive   = true
}

variable "support_email" {
  type        = string
  description = "Email address for critical alerts (e.g. support@lax.bid)."
}

variable "team_internal_id" {
  type        = string
  description = "Sentry team internal ID for email notifications."
}

variable "enable_slack" {
  type        = bool
  description = "Include Slack actions in alert routing."
  default     = false
}

variable "enable_pagerduty" {
  type        = bool
  description = "Include PagerDuty actions in alert routing."
  default     = false
}
