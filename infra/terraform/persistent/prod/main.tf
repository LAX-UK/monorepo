locals {
  environment  = "prod"
  region       = "lon1"
  zone_name    = "lax.bid"
  media_cdn    = "lax-media.lon1.cdn.digitaloceanspaces.com"
  app_hostname = "lax-prod-app-iekuk.ondigitalocean.app"
  subdomains = {
    web                  = { name = "@", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod web App Platform hostname" }
    www                  = { name = "www", type = "CNAME", value = local.app_hostname, proxied = true, comment = "www redirect to apex (handled by Cloudflare redirect rule)" }
    api                  = { name = "api", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod api App Platform hostname" }
    auth                 = { name = "auth", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod auth App Platform hostname" }
    ws                   = { name = "ws", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod ws App Platform hostname" }
    media                = { name = "media", type = "CNAME", value = local.media_cdn, proxied = true, comment = "lax prod media CDN" }
    postmark_dkim        = { name = "20260505002152pm._domainkey.mail", type = "TXT", value = "k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDi/NrnU+oeVXNo0sJM72mILqXSYfL76kXxMfPFtoivITNVd3bSJjzcurIm2M0VqnE2L7O20xc35lYMTnRddm3BrU8UXJ6D+dq4yp8l+Nl3min0w0V9dCFgBL0TijdVP52yBlQwgQfi/IkUOPo4jxukYdcvu4NNy2r6sdnEvPcjRwIDAQAB", proxied = false, comment = "Postmark prod DKIM" }
    postmark_return_path = { name = "pm-bounces.mail", type = "CNAME", value = "pm.mtasv.net", proxied = false, comment = "Postmark prod Return-Path" }
    mail_spf = { name = "mail", type = "TXT", value = "v=spf1 include:spf.mtasv.net ~all", proxied = false, comment = "Postmark SPF for mail.lax.bid sender domain" }
    mail_dmarc = { name = "_dmarc.mail", type = "TXT", value = "v=DMARC1; p=quarantine; rua=mailto:support@lax.bid; fo=1", proxied = false, comment = "DMARC for mail.lax.bid (align with Postmark)" }
  }
}

module "cloudflare_domain" {
  source         = "../../modules/cloudflare-domain"
  zone_name      = local.zone_name
  account_id     = var.cloudflare_account_id
  environment    = local.environment
  security_level = "high"
  subdomains     = local.subdomains
  # Include test hosts so one zone ruleset covers both envs (test stack does not create rulesets).
  auth_hosts = ["auth.lax.bid", "test-auth.lax.bid"]
  api_hosts  = ["api.lax.bid", "test-api.lax.bid"]
}

module "media" {
  source               = "../../modules/digitalocean-spaces"
  bucket_name          = "lax-media"
  region               = local.region
  environment          = local.environment
  cors_allowed_origins = ["https://lax.bid", "https://api.lax.bid", "https://auth.lax.bid", "https://ws.lax.bid", "https://test.lax.bid", "https://test-api.lax.bid", "https://test-auth.lax.bid", "https://test-ws.lax.bid"]
}

module "project" {
  source        = "../../modules/digitalocean-project"
  name          = "lax-prod-project"
  description   = "lax.bid prod resources"
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

module "sentry_alerts" {
  count = var.sentry_auth_token != "" ? 1 : 0

  source              = "../../modules/sentry-alerts"
  organization_slug   = var.sentry_organization_slug
  team_slug           = var.sentry_team_slug
  project_slugs       = toset([for _k, slug in module.sentry_projects[0].project_slugs : slug])
}
