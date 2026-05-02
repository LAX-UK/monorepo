terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "= 2.43.0" }
    cloudflare   = { source = "cloudflare/cloudflare", version = "= 4.45.0" }
    postgresql   = { source = "cyrilgdn/postgresql", version = "= 1.23.0" }
    sentry       = { source = "jianyuan/sentry", version = "= 0.13.0" }
    random       = { source = "hashicorp/random", version = "~> 3.6" }
    time         = { source = "hashicorp/time", version = "~> 0.11" }
    null         = { source = "hashicorp/null", version = "~> 3.2" }
    local        = { source = "hashicorp/local", version = "~> 2.5" }
  }
}
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
  type = string
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
