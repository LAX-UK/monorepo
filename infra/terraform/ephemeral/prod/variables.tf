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
  default     = "LAX.BID by London Art Xxchange <no-reply@mail.lax.bid>"
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

# --- Stripe + internal jobs + KYC + ops (apps/api, apps/worker) ---
variable "stripe_secret_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe secret key (sk_live_… in production)."
}
variable "stripe_publishable_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe publishable key (pk_live_… in production)."
}
variable "stripe_identity_webhook_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe Identity webhook signing secret (whsec_…)."
}
variable "stripe_connect_webhook_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe Connect webhook signing secret (whsec_…)."
}
variable "stripe_payments_webhook_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Stripe Payments webhook signing secret (whsec_…) for disputes/refunds."
}
variable "cron_internal_secret" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Shared secret for worker → API internal cron (min 32 chars in production)."
}
variable "kyc_threshold_amount" {
  type        = string
  default     = "1000"
  description = "KYC threshold in major currency units (string for App Platform env)."
}
variable "kyc_threshold_currency" {
  type        = string
  default     = "GBP"
  description = "ISO 4217 currency code for KYC threshold."
}
variable "ops_support_email" {
  type        = string
  default     = ""
  description = "Support inbox for ops alerts (e.g. support@lax.bid)."
}
variable "ops_oncall_email" {
  type        = string
  default     = ""
  description = "On-call escalation email."
}
variable "admin_email_address" {
  type        = string
  default     = ""
  description = "Worker ops notifications (must match production validation)."
}

# --- Xero (optional OAuth; all three must be set together in app env) ---
variable "xero_client_id" {
  type        = string
  default     = ""
  sensitive   = true
}
variable "xero_client_secret" {
  type        = string
  default     = ""
  sensitive   = true
}
variable "xero_redirect_uri" {
  type        = string
  default     = ""
  description = "OAuth redirect URI registered in Xero (e.g. https://api.lax.bid/admin/integrations/xero/callback)."
}
variable "xero_webhook_key" {
  type        = string
  default     = ""
  sensitive   = true
}
variable "xero_default_revenue_account_code" {
  type    = string
  default = "200"
}
variable "xero_default_tax_type" {
  type    = string
  default = "NONE"
}
variable "xero_invoice_due_days" {
  type    = string
  default = "14"
}
variable "xero_post_connect_web_redirect" {
  type        = string
  default     = ""
  description = "Browser redirect after Xero OAuth (e.g. https://lax.bid/admin/integrations/xero)."
}
variable "xero_use_legal_entity_contact" {
  type        = string
  default     = "false"
  description = "When \"true\", buyer AR contacts use legal_entity.xero_contact_id."
}
variable "xero_payout_bill_account_code" {
  type    = string
  default = "400"
}

# --- Auth hardening (auth-hardening branch) ---

variable "auth_dek_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "32-byte DEK for envelope-encrypting OAuth tokens and 2FA secrets at rest. Hex (64 chars) or base64url (44 chars). Required in NODE_ENV=production. Generate: openssl rand -hex 32"
}

variable "turnstile_secret_key" {
  type        = string
  default     = ""
  sensitive   = true
  description = "Cloudflare Turnstile secret key. When set, sign-in, register, and forgot-password require a valid widget token. Obtain from dash.cloudflare.com → Turnstile → Create site."
}

variable "turnstile_site_key" {
  type        = string
  default     = ""
  description = "Cloudflare Turnstile public site key (rendered by the browser widget). Obtain alongside turnstile_secret_key."
}

variable "verify_origin" {
  type        = string
  default     = "true"
  description = "When \"true\", mutating non-auth requests must carry an Origin/Referer matching WEB_ORIGIN."
  validation {
    condition     = contains(["true", "false"], var.verify_origin)
    error_message = "verify_origin must be \"true\" or \"false\"."
  }
}

variable "csp_enforce" {
  type        = string
  default     = "0"
  description = "Set to \"1\" to flip Content-Security-Policy from report-only to enforcing on apps/web."
  validation {
    condition     = contains(["0", "1"], var.csp_enforce)
    error_message = "csp_enforce must be \"0\" or \"1\"."
  }
}

variable "next_public_csp_report_uri" {
  type        = string
  default     = ""
  description = "Optional CSP violation report endpoint (e.g. https://o123.ingest.sentry.io/api/456/security/?sentry_key=…)."
}

# --- Analytics (Google Tag Manager) ---

variable "next_public_gtm_id" {
  type        = string
  default     = ""
  description = "Google Tag Manager container ID (e.g. GTM-W6K4N67Z). GA4 is configured inside GTM. Empty disables analytics."
}
