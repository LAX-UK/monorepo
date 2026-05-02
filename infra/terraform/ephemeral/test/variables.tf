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
variable "repository_clone_url" {
  type    = string
  default = "https://github.com/LAX-UK/monorepo.git"
}
variable "better_auth_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "google_client_id" {
  type      = string
  default   = ""
  sensitive = true
}
variable "google_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "spaces_access_key_id" {
  type      = string
  default   = ""
  sensitive = true
}
variable "spaces_secret_access_key" {
  type      = string
  default   = ""
  sensitive = true
}
variable "shopify_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "wordpress_webhook_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "zoho_client_id" {
  type      = string
  default   = ""
  sensitive = true
}
variable "zoho_client_secret" {
  type      = string
  default   = ""
  sensitive = true
}
variable "zoho_refresh_token" {
  type      = string
  default   = ""
  sensitive = true
}
