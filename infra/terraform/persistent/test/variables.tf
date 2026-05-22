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
