variable "ops_alert_email" {
  type        = string
  default     = ""
  description = "Verified team email in DigitalOcean for DB monitor + uptime alert notifications. Empty skips those alert resources."
}

variable "digitalocean_project_id" {
  type        = string
  default     = ""
  description = "Override DO project UUID. If empty: use persistent-prod remote output, else lookup by API name lax-prod-project."
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

# DigitalOcean returns "Git branch not found" if this branch does not exist on the repo.
# Default release matches .github/workflows/app-deploy-prod.yml; override via TF_VAR_app_git_branch.
variable "app_git_branch" {
  type        = string
  default     = "release"
  description = "Git branch App Platform builds from (must exist on GitHub)."
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

# --- Email pipeline (Postmark transactional + Zoho Campaigns newsletter push) ---
# Prod defaults: email_provider="postmark" and require_email_verification="true". Both apps/api and
# apps/auth will refuse to start when email_provider="postmark" without postmark_server_token, so
# that secret MUST be wired through TF_VAR_postmark_server_token before applying.
variable "email_provider" {
  type        = string
  default     = "postmark"
  description = "Email service provider. \"console\" stubs sends; \"postmark\" hits the live API."
  validation {
    condition     = contains(["console", "postmark"], var.email_provider)
    error_message = "email_provider must be \"console\" or \"postmark\"."
  }
}
variable "email_from" {
  type        = string
  default     = "LAX <no-reply@mail.lax.bid>"
  description = "Default From header for transactional/notification mail."
}
variable "email_reply_to" {
  type        = string
  default     = "settlements@lax.bid"
  description = "Default Reply-To header (empty string disables Reply-To)."
}
variable "postmark_server_token" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Postmark Server token used by apps/worker to send mail. Required at runtime when email_provider=\"postmark\"."
}
variable "postmark_transactional_stream" {
  type        = string
  default     = "outbound"
  description = "Postmark message stream id used for per-user transactional/notification mail."
}
variable "postmark_broadcast_stream" {
  type        = string
  default     = "broadcast"
  description = "Postmark message stream id used for bulk/broadcast mail."
}
variable "postmark_webhook_basic_auth" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Basic Auth credential (user:password) Postmark uses to call /webhooks/postmark on apps/api."
}
variable "email_unsubscribe_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "HMAC secret for List-Unsubscribe tokens. Empty -> Terraform generates and persists a stable random secret. Rotation invalidates already-delivered unsubscribe links."
}
variable "require_email_verification" {
  type        = string
  default     = "true"
  description = "When \"true\", sign-in is gated on a verified email. Set to \"false\" temporarily during a Postmark outage."
  validation {
    condition     = contains(["true", "false"], var.require_email_verification)
    error_message = "require_email_verification must be the string \"true\" or \"false\"."
  }
}
variable "enable_whatsapp_channel" {
  type        = string
  default     = "false"
  description = "Feature flag for the WhatsApp notification channel (currently a stub)."
  validation {
    condition     = contains(["true", "false"], var.enable_whatsapp_channel)
    error_message = "enable_whatsapp_channel must be the string \"true\" or \"false\"."
  }
}
variable "zoho_campaigns_api_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Zoho Campaigns API key used by apps/worker for one-way newsletter push."
}
variable "zoho_campaigns_list_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Zoho Campaigns target list key used by apps/worker."
}
