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
variable "digitalocean_token" {
  type      = string
  sensitive = true
}
variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}
variable "cloudflare_account_id" {
  type      = string
  sensitive = true
}
variable "sentry_auth_token" {
  type      = string
  sensitive = true
}
variable "sentry_organization_slug" {
  type    = string
  default = "lax"
}
variable "sentry_team_slug" {
  type    = string
  default = "lax-engineering"
}
