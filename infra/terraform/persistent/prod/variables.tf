variable "digitalocean_token" {
  type      = string
  sensitive = true
}

# Same keys as App runtime media access; required for digitalocean_spaces_bucket in this layer.
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
  default   = ""
  sensitive = true
}
variable "sentry_organization_slug" {
  type    = string
  default = "lax-bid"
}
variable "sentry_team_slug" {
  type    = string
  default = "lax-engineering"
}
