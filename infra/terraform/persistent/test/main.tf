locals {
  environment  = "test"
  region       = "lon1"
  zone_name    = "lax.bid"
  media_cdn    = "lax-media.lon1.cdn.digitaloceanspaces.com"
  app_hostname = "lax-test-app-s3u4b.ondigitalocean.app"
  subdomains = {
    web                  = { name = "test", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test web App Platform hostname" }
    api                  = { name = "test-api", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test api App Platform hostname" }
    auth                 = { name = "test-auth", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test auth App Platform hostname" }
    ws                   = { name = "test-ws", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test ws App Platform hostname" }
    media                = { name = "test-media", type = "CNAME", value = local.media_cdn, proxied = false, comment = "lax test media CDN (not proxied for Let's Encrypt and Host header matching)" }
    postmark_dkim        = { name = "20260505005739pm._domainkey.mail.test", type = "TXT", value = "k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDfWy7bTm/IOyqliVj57Fkq8W3UvPumahYO7OmojSKB/858B7uUIWA7+ywN6TrFgJXYLcJqEPZOXLatIoHqED+Rjbe1xi4ReSjENLUIrvM2WMHNPB5kzoZjBDlTItTIPa1gqmW8TEhiQ+ScZ5KHkS+iEOzlirv/Fnwr32j4Xtt3PQIDAQAB", proxied = false, comment = "Postmark test DKIM" }
    postmark_return_path = { name = "pm-bounces.mail.test", type = "CNAME", value = "pm.mtasv.net", proxied = false, comment = "Postmark test Return-Path" }
    mail_test_spf        = { name = "mail.test", type = "TXT", value = "v=spf1 include:spf.mtasv.net ~all", proxied = false, comment = "Postmark SPF for mail.test.lax.bid" }
    mail_test_dmarc      = { name = "_dmarc.mail.test", type = "TXT", value = "v=DMARC1; p=none; rua=mailto:support@lax.bid", proxied = false, comment = "DMARC for mail.test.lax.bid" }
  }
}

module "cloudflare_domain" {
  source = "../../modules/cloudflare-domain"
  # Same zone as prod; zone-level rulesets are singletons — prod stack owns merged rules.
  manage_firewall_rulesets = false
  zone_name                = local.zone_name
  account_id               = var.cloudflare_account_id
  environment              = local.environment
  security_level           = "medium"
  subdomains               = local.subdomains
  auth_hosts               = ["test-auth.lax.bid"]
  api_hosts                = ["test-api.lax.bid"]
}
# lax-media is provisioned once from persistent/prod and shared by prefix.

module "project" {
  source        = "../../modules/digitalocean-project"
  name          = "lax-test-project"
  description   = "lax.bid test resources"
  environment   = local.environment
  resource_urns = []
}

module "sentry_projects" {
  count = var.sentry_auth_token != "" ? 1 : 0

  source            = "../../modules/sentry-projects"
  organization_slug = var.sentry_organization_slug
  team_slug         = var.sentry_team_slug
  environment       = local.environment
  project_names     = [for app in ["web", "api", "auth", "ws", "worker"] : "lax-${local.environment}-${app}"]
}
