variable "environment" {
  description = "Deployment environment name."
  type        = string
}

variable "region" {
  description = "DigitalOcean region slug."
  type        = string
  default     = "lon1"
}
