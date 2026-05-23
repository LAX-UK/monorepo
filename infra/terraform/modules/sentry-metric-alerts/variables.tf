variable "organization_slug" {
  type        = string
  description = "Sentry organization slug."
}

variable "project_slug" {
  type        = string
  description = "Sentry project slug."
}

variable "app_key" {
  type        = string
  description = "App key (web, api, auth, ws, worker)."
}

variable "p95_ms" {
  type        = number
  description = "P95 latency threshold in ms; null skips the alert."
  default     = null
}

variable "enable_money_path_alerts" {
  type        = bool
  description = "Create Stripe webhook and payout failure alerts (api project only)."
  default     = false
}

variable "slack_integration_id" {
  type        = string
  description = "Slack integration ID for metric alert actions."
}

variable "slack_channel_id" {
  type        = string
  description = "Slack channel ID for metric alert actions."
}

variable "pagerduty_integration_id" {
  type        = string
  description = "PagerDuty integration ID (empty when paging disabled)."
  default     = ""
}

variable "pagerduty_service_id" {
  type        = string
  description = "PagerDuty service ID in Sentry (empty when paging disabled)."
  default     = ""
}

variable "team_internal_id" {
  type        = string
  description = "Team internal ID for email metric alert actions."
}

variable "enable_slack" {
  type        = bool
  description = "Send metric alert notifications to Slack."
  default     = false
}

variable "slack_channel" {
  type        = string
  description = "Slack channel name for metric alert actions."
  default     = "#alerts-engineering"
}
