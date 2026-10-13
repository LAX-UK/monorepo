terraform {
  required_version = "= 1.9.8"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 4.45.0"
    }
  }
}

# ATG White Label on a LAX subdomain. LAX cookies are scoped to the parent domain, so the
# hostname is only ever published proxied through the cookie-shield Worker
# (workers/atg-cookie-shield), which strips LAX cookies before requests reach ATG.

locals {
  hostname = "${var.record_name}.${var.zone_name}"
}

resource "cloudflare_record" "acm_validation" {
  count = var.acm_validation_enabled ? 1 : 0

  zone_id = var.zone_id
  name    = var.acm_validation.name
  type    = "CNAME"
  content = var.acm_validation.value
  proxied = false
  ttl     = 1
  comment = "ATG White Label ACM certificate validation"
}

resource "cloudflare_workers_script" "cookie_shield" {
  count = var.enabled ? 1 : 0

  account_id         = var.account_id
  name               = var.worker_name
  content            = file("${path.module}/../../../workers/atg-cookie-shield/shield.js")
  module             = true
  compatibility_date = "2025-09-01"
}

# Fails closed by default (request_limit_fail_open = false; provider 4.45 does not expose it).
resource "cloudflare_workers_route" "cookie_shield" {
  count = var.enabled ? 1 : 0

  zone_id     = var.zone_id
  pattern     = "${local.hostname}/*"
  script_name = cloudflare_workers_script.cookie_shield[0].name
}

resource "cloudflare_record" "white_label" {
  count = var.enabled ? 1 : 0

  zone_id = var.zone_id
  name    = var.record_name
  type    = "CNAME"
  content = var.origin
  proxied = true
  ttl     = 1
  comment = "ATG White Label (${local.hostname}), proxied through the cookie-shield Worker"

  depends_on = [cloudflare_workers_route.cookie_shield]
}
