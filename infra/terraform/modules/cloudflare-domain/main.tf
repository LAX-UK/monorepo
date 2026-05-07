terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.85.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 4.45.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.23.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "= 0.13.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}

data "cloudflare_zone" "this" {
  name = var.zone_name
}

resource "cloudflare_record" "subdomain" {
  for_each = var.subdomains

  zone_id         = data.cloudflare_zone.this.id
  name            = each.value.name
  type            = each.value.type
  content         = each.value.value
  proxied         = each.value.proxied
  ttl             = 1
  comment         = each.value.comment
  allow_overwrite = true
}

resource "cloudflare_zone_settings_override" "this" {
  zone_id = data.cloudflare_zone.this.id

  settings {
    ssl              = "strict"
    security_level   = var.security_level
    min_tls_version  = "1.2"
    always_use_https = "on"
  }
}

locals {
  auth_host_expression = join(" ", [for host in var.auth_hosts : "\"${host}\""])
  api_host_expression  = join(" ", [for host in var.api_hosts : "\"${host}\""])
}

# Named zone_auth_waf (not auth_waf) so upgrades from pre-count state destroy the old
# address cleanly when test sets manage_firewall_rulesets = false.
resource "cloudflare_ruleset" "zone_auth_waf" {
  count = var.manage_firewall_rulesets ? 1 : 0

  zone_id     = data.cloudflare_zone.this.id
  name        = "lax-${var.environment}-auth-waf"
  description = "Host-scoped auth WAF rules."
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules {
    action      = "managed_challenge"
    expression  = "(http.host in {${local.auth_host_expression}} and http.request.uri.path eq \"/api/auth/authorize\" and not http.user_agent contains \"Mozilla\")"
    description = "Challenge non-browser authorize requests."
    enabled     = true
  }
}

resource "cloudflare_ruleset" "zone_rate_limits" {
  count = var.manage_firewall_rulesets ? 1 : 0

  zone_id     = data.cloudflare_zone.this.id
  name        = "lax-${var.environment}-rate-limits"
  description = "Host-scoped API and auth rate limits."
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action      = "block"
    expression  = "(http.host in {${local.auth_host_expression}} and http.request.uri.path in {\"/api/auth/sign-up\" \"/api/auth/send-verification-email\"})"
    description = "Auth sign-up and verification-email reputation guard."
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = min(var.signup_rpm, var.send_verification_email_rpm)
      mitigation_timeout  = 10
    }
  }
}
