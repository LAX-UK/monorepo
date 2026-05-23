variable "environment" {
  type        = string
  description = "Deployment environment (prod or test)."

  validation {
    condition     = contains(["prod", "test"], var.environment)
    error_message = "environment must be prod or test."
  }
}

variable "worker_crons" {
  type = map(object({
    schedule       = string
    checkin_margin = number
    max_runtime    = number
    timezone       = string
  }))
  description = "Cron monitor definitions keyed by slug."
}
