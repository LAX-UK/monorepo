variable "ops_alert_email" {
  type        = string
  default     = ""
  description = "Verified team email in DigitalOcean for DB monitor + uptime alert notifications. Empty skips those alert resources."
}

variable "digitalocean_project_id" {
  type        = string
  default     = ""
  description = "Override DO project UUID. If empty: use persistent-test remote output, else lookup by API name lax-test-project."
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
  default   = ""
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
variable "apple_client_id" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Apple Services ID used for Sign in with Apple."
}
variable "apple_client_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Generated Apple client-secret JWT. Rotate at least every 180 days."
}
variable "apple_domain_association" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Apple domain association file content served by apps/auth for Sign in with Apple verification."
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
