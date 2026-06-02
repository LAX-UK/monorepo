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
  priority        = try(each.value.priority, null)
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

  test_noindex_host_expression = length(var.test_hosts) > 0 ? join(" or ", [
    for host in sort(tolist(var.test_hosts)) : "(http.host eq \"${host}\")"
  ]) : "false"

  bot_ua_allow_clauses = [
    for ua in sort(tolist(var.whitelisted_bot_user_agents)) : "(http.user_agent contains \"${ua}\")"
  ]
  bot_allow_expression = var.whitelist_cf_client_bot ? (
    length(local.bot_ua_allow_clauses) > 0 ?
    join(" or ", concat(["(cf.client.bot)"], local.bot_ua_allow_clauses)) :
    "(cf.client.bot)"
    ) : (
    length(local.bot_ua_allow_clauses) > 0 ?
    join(" or ", local.bot_ua_allow_clauses) :
    "false"
  )
  bot_allow_negated = "not (${local.bot_allow_expression})"

  # Free tier http_ratelimit: period must be 10 (not 60), mitigation_timeout must
  # be 10 (not 60). Map the intended per-minute cap (min of the two auth paths)
  # into the 10s window via ceil.
  auth_ratelimit_rpm_effective    = min(var.signup_rpm, var.send_verification_email_rpm)
  auth_ratelimit_requests_per_10s = max(1, ceil(local.auth_ratelimit_rpm_effective * 10.0 / 60.0))
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

  dynamic "rules" {
    for_each = local.bot_allow_expression != "false" ? [1] : []
    content {
      action      = "skip"
      expression  = local.bot_allow_expression
      description = "Allow listed crawlers/monitoring bots (skip remaining custom WAF + auth rate limit)."
      enabled     = true

      action_parameters {
        ruleset = "current"
        phases  = ["http_ratelimit"]
      }

      # logging is only valid on skip (API 20018); required so provider state matches API response.
      logging {
        enabled = false
      }
    }
  }

  rules {
    action      = "managed_challenge"
    expression  = "(${local.bot_allow_negated}) and (http.host in {${local.auth_host_expression}} and http.request.uri.path eq \"/api/auth/authorize\" and not http.user_agent contains \"Mozilla\")"
    description = "Challenge non-browser authorize requests (excluding bot allowlist)."
    enabled     = true
  }
}

# Cloudflare Free plan caps the http_ratelimit phase at ONE rule per zone (error 50001)
# and only allows period 10s and mitigation_timeout 10s (not 60) for that phase.
# Production protection is prioritized: this rule guards the highest-stakes auth endpoints
# (sign-up and email-verification) which are the realistic edge attack surface
# (account-creation abuse, email-bombing). Lower-priority paths
# (/.well-known/*, /webhooks/postmark) are protected at the app layer instead — see
# apps/api/src/middleware/rate-limit.ts and docs/integrations/cloudflare.md.
# When the zone is upgraded to Pro (10 rules), restore the per-path rules from
# git history (commit a8027e39) and reference postmark_webhook_rpm again.
resource "cloudflare_ruleset" "zone_rate_limits" {
  count = var.manage_firewall_rulesets ? 1 : 0

  zone_id     = data.cloudflare_zone.this.id
  name        = "lax-${var.environment}-rate-limits"
  description = "Auth abuse guard (Free-plan single-rule budget; see docs/integrations/cloudflare.md)."
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action      = "block"
    expression  = "(http.host in {${local.auth_host_expression}} and http.request.uri.path in {\"/api/auth/sign-up\" \"/api/auth/send-verification-email\"})"
    description = "Auth sign-up + verification-email: shared bucket (Free: 1 rule, 10s period + 10s mitigation; RPM via locals)."
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = 10
      requests_per_period = local.auth_ratelimit_requests_per_10s
      mitigation_timeout  = 10
    }
  }
}

# Redirect www.lax.bid → lax.bid (301 permanent redirect, preserves path/query)
resource "cloudflare_ruleset" "www_redirect" {
  count = var.manage_firewall_rulesets ? 1 : 0

  zone_id     = data.cloudflare_zone.this.id
  name        = "lax-www-to-apex-redirect"
  description = "Redirect www to apex domain."
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules {
    action      = "redirect"
    expression  = "(http.host eq \"www.${var.zone_name}\")"
    description = "www to apex 301 redirect"
    enabled     = true

    action_parameters {
      from_value {
        status_code = 301
        target_url {
          expression = "concat(\"https://${var.zone_name}\", http.request.uri.path)"
        }
        preserve_query_string = true
      }
    }
  }
}

# Block search indexing on test subdomains (test.lax.bid, test-api.lax.bid, etc.).
# App-layer noindex on web is the primary control; this covers API/auth HTML surfaces too.
resource "cloudflare_ruleset" "test_noindex" {
  count = var.manage_firewall_rulesets ? 1 : 0

  zone_id     = data.cloudflare_zone.this.id
  name        = "lax-test-noindex-headers"
  description = "Set X-Robots-Tag on test subdomains to prevent search indexing."
  kind        = "zone"
  phase       = "http_response_headers_transform"

  rules {
    action      = "rewrite"
    expression  = local.test_noindex_host_expression
    description = "Noindex listed test hostnames (explicit eq; Free-plan safe)"
    enabled     = true

    action_parameters {
      headers {
        name      = "X-Robots-Tag"
        operation = "set"
        value     = "noindex, nofollow, noarchive"
      }
    }
  }
}
