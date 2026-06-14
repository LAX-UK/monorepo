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

variable "deploy_source" {
  type        = string
  default     = "github"
  description = "Where App Platform pulls each component from. 'github' = build from the repo on DO (default, current behavior). 'image' = pull a prebuilt image from DOCR (CI builds + pushes; DO only pulls). Switch to 'image' only after the registry exists and the images have been pushed at least once."
  validation {
    condition     = contains(["github", "image"], var.deploy_source)
    error_message = "deploy_source must be either \"github\" or \"image\"."
  }
}

variable "image_tag" {
  type        = string
  default     = ""
  description = "DOCR tag every component is pinned to when deploy_source = \"image\". Empty falls back to the environment name (e.g. \"prod\"). CI overwrites this rolling tag on each build; the deploy is triggered separately via `doctl apps create-deployment`, which always pulls the current tag."
}

variable "components" {
  type = list(object({
    name                               = string
    kind                               = string
    source_dir                         = string
    dockerfile_path                    = string
    run_command                        = optional(string)
    http_port                          = optional(number)
    instance_size                      = string
    instance_count                     = optional(number)
    health_check_path                  = optional(string)
    health_check_initial_delay_seconds = optional(number)
    health_check_period_seconds        = optional(number)
    internal_ports                     = optional(list(number))
    domain                             = optional(string)
    primary_domain                     = optional(bool, false)
    autoscaling = optional(object({
      min_instance_count = number
      max_instance_count = number
      cpu_percent        = number
    }))
    # DOCR repository name (within the account registry) used when
    # deploy_source = "image". Defaults to "lax-<environment>-<name>".
    image_repository = optional(string)
    # Per-component override of the module-level deploy_source. Null = inherit
    # (all components including web use DOCR when app_deploy_source = "image").
    deploy_source = optional(string)
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
