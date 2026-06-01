variable "name" {
  type = string
}
variable "environment" {
  type = string
}
variable "region" {
  type = string
}
variable "repository_clone_url" {
  type        = string
  description = "Canonical Git remote (HTTPS or SSH). Used to derive owner/repo slug for the github App source when github_repo is empty."
}
variable "github_repo" {
  type        = string
  default     = ""
  description = "GitHub slug owner/repo for App Platform github source. Empty parses repository_clone_url or defaults to LAX-UK/monorepo."
}
variable "branch" {
  type = string
}
variable "components" {
  type = list(object({
    name              = string
    kind              = string
    source_dir        = string
    dockerfile_path   = string
    run_command       = optional(string)
    http_port         = optional(number)
    instance_size     = string
    instance_count    = number
    health_check_path = optional(string)
    domain            = optional(string)
    primary_domain    = optional(bool, false)
    env = list(object({
      key   = string
      value = string
      type  = string
      scope = string
    }))
  }))
  sensitive = true
}

variable "path_routes" {
  type = list(object({
    authority   = string
    path_prefix = string
    component   = string
  }))
  default     = []
  description = "Path-scoped ingress rules evaluated before per-domain catch-all rules (e.g. lax.bid/q -> api)."
}
