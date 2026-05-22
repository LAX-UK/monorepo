variable "organization_slug" {
  type        = string
  description = "Sentry organization slug."
}

variable "team_slug" {
  type        = string
  description = "Team slug that owns the project."
}

variable "app_key" {
  type        = string
  description = "Short app key (web, api, auth, ws, worker)."
}

variable "project_name" {
  type        = string
  description = "Sentry project name (e.g. lax-prod-api)."
}

variable "platform" {
  type        = string
  description = "Sentry platform identifier."

  validation {
    condition = contains([
      "javascript-nextjs",
      "node",
      "javascript",
      "other",
    ], var.platform)
    error_message = "platform must be a supported Sentry platform string."
  }
}

variable "enable_code_mappings" {
  type        = bool
  default     = false
  description = "Create GitHub code mappings for apps/ and packages/."
}

variable "github_integration_id" {
  type        = string
  default     = ""
  description = "GitHub integration ID for code mappings."
}

variable "github_repository_id" {
  type        = string
  default     = ""
  description = "Sentry organization repository ID."
}

variable "inbound_filters" {
  type        = set(string)
  description = "Inbound data filter IDs to enable."
}

variable "rate_limit_count" {
  type        = number
  description = "Max events per rate_limit_window."
  default     = 10000
}

variable "rate_limit_window" {
  type        = number
  description = "Rate limit window in seconds."
  default     = 60
}
