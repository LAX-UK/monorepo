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

# --- DigitalOcean Container Registry (account-level singleton) ---
# DOCR is one registry per DO account (many repositories inside), so it lives in
# the prod persistent layer and is shared by both envs (repos: lax-<env>-<comp>).
# Creation is opt-in (costs ~$5+/mo) so this change stays inert until enabled.
variable "create_container_registry" {
  type        = bool
  default     = false
  description = "Create the account-level DOCR registry used for prebuilt App Platform images. Leave false until you are ready to adopt image-based deploys."
}
variable "container_registry_name" {
  type        = string
  default     = "lax-bid"
  description = "Globally-unique DOCR registry name (becomes registry.digitalocean.com/<name>). Must be available across all of DigitalOcean."
}
variable "container_registry_subscription_tier" {
  type    = string
  default = "professional"
  # The image-based components are api/auth/ws/worker/migrate = 5 repos PER env.
  # With both test + prod that is 10 repos (lax-<env>-<component>). The 'basic'
  # tier caps at 5 repositories, so 'professional' (unlimited repos, 100 GiB) is
  # required once both envs use DOCR. 'basic' only suffices for a single env.
  description = "DOCR subscription tier slug: 'professional' (unlimited repos) for both envs, or 'basic' (max 5 repos) for a single env."
  validation {
    condition     = contains(["starter", "basic", "professional"], var.container_registry_subscription_tier)
    error_message = "container_registry_subscription_tier must be one of: starter, basic, professional."
  }
}
variable "container_registry_region" {
  type    = string
  default = "fra1"
  # DOCR is NOT offered in lon1 (where the app runs). Supported regions are
  # nyc3, sfo3, ams3, sgp1, fra1 — fra1 (Frankfurt) is the closest/EU option.
  description = "DOCR data region. Must be one of nyc3, sfo3, ams3, sgp1, fra1 (DOCR is unavailable in lon1)."
  validation {
    condition     = contains(["nyc3", "sfo3", "ams3", "sgp1", "fra1"], var.container_registry_region)
    error_message = "container_registry_region must be one of: nyc3, sfo3, ams3, sgp1, fra1."
  }
}
