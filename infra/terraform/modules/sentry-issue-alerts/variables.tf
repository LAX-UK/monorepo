variable "organization_slug" {
  type        = string
  description = "Sentry organization slug."
}

variable "project_slug" {
  type        = string
  description = "Sentry project slug."
}

variable "warning_actions_v2" {
  type        = any
  description = "actions_v2 for warning-severity issue alerts."
}

variable "critical_actions_v2" {
  type        = any
  description = "actions_v2 for critical-severity issue alerts."
}
