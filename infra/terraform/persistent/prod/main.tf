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
    event                = { name = "event", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod opening-event RSVP landing (event.lax.bid)" }
    gtm                  = { name = "gtm", type = "CNAME", value = "eum.stape.io", proxied = false, comment = "lax prod sGTM via Stape (DNS-only; Stape terminates TLS on eum.stape.io)" }
    media                = { name = "media", type = "CNAME", value = local.media_cdn, proxied = false, comment = "lax prod media CDN (legacy - app uses CDN URL directly)" }
    cdn                  = { name = "cdn", type = "CNAME", value = local.media_cdn, proxied = false, comment = "lax prod static assets CDN (email + event landing images)" }
    postmark_dkim        = { name = "20260505002152pm._domainkey.mail", type = "TXT", value = "k=rsa;p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDi/NrnU+oeVXNo0sJM72mILqXSYfL76kXxMfPFtoivITNVd3bSJjzcurIm2M0VqnE2L7O20xc35lYMTnRddm3BrU8UXJ6D+dq4yp8l+Nl3min0w0V9dCFgBL0TijdVP52yBlQwgQfi/IkUOPo4jxukYdcvu4NNy2r6sdnEvPcjRwIDAQAB", proxied = false, comment = "Postmark prod DKIM" }
    postmark_return_path = { name = "pm-bounces.mail", type = "CNAME", value = "pm.mtasv.net", proxied = false, comment = "Postmark prod Return-Path" }
    mail_spf             = { name = "mail", type = "TXT", value = "v=spf1 include:spf.mtasv.net ~all", proxied = false, comment = "Postmark SPF for mail.lax.bid sender domain" }
    mail_dmarc           = { name = "_dmarc.mail", type = "TXT", value = "v=DMARC1; p=quarantine; rua=mailto:support@lax.bid; fo=1", proxied = false, comment = "DMARC for mail.lax.bid (align with Postmark)" }
    brevo_domain_verify  = { name = "news", type = "TXT", value = "brevo-code:318334ee61d5127a6ea5c06855f7f9f8", proxied = false, comment = "Brevo domain verification for news.lax.bid" }
    brevo_dkim_1         = { name = "brevo1._domainkey.news", type = "CNAME", value = "b1.news-lax-bid.dkim.brevo.com", proxied = false, comment = "Brevo DKIM 1 for news.lax.bid" }
    brevo_dkim_2         = { name = "brevo2._domainkey.news", type = "CNAME", value = "b2.news-lax-bid.dkim.brevo.com", proxied = false, comment = "Brevo DKIM 2 for news.lax.bid" }
    brevo_dmarc          = { name = "_dmarc.news", type = "TXT", value = "v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com", proxied = false, comment = "DMARC for news.lax.bid (Brevo marketing)" }
    zoho_mail_verify     = { name = "@", type = "TXT", value = "zoho-verification=zb23174584.zmverify.zoho.eu", proxied = false, comment = "Zoho Mail domain verification (EU)" }
    zoho_mx_primary      = { name = "@", type = "MX", value = "mx.zoho.eu", priority = 10, proxied = false, comment = "Zoho Mail EU inbound" }
    zoho_mx_secondary    = { name = "@", type = "MX", value = "mx2.zoho.eu", priority = 20, proxied = false, comment = "Zoho Mail EU inbound" }
    zoho_mx_tertiary     = { name = "@", type = "MX", value = "mx3.zoho.eu", priority = 50, proxied = false, comment = "Zoho Mail EU inbound" }
    zoho_spf             = { name = "@", type = "TXT", value = "v=spf1 include:zohomail.eu ~all", proxied = false, comment = "Zoho Mail SPF for @lax.bid" }
    zoho_dkim            = { name = "zmail._domainkey", type = "TXT", value = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDA5/sNBc3Octb83NV7Dk2coky2nAWToQXeZZfKkbNMflcIMj5845FnqCDmGm4ArDzDT+sd/TEjO/uQ3+s0hWjkCsK6+frfzpHgbNMDpaxL6nLmslyc1bEN0DpIj2L2Ma0Pf8t7KRAlJDIuLeIR3GC6J8r58caQgx7yDNSBZP9HkwIDAQAB", proxied = false, comment = "Zoho Mail DKIM" }
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
  test_hosts = [
    "test.lax.bid",
    "test-api.lax.bid",
    "test-auth.lax.bid",
    "test-ws.lax.bid",
    "test-media.lax.bid",
  ]
  # Optional: override bot allowlist (must include full set; replaces module defaults).
  # whitelisted_bot_user_agents = toset(["Googlebot", "GPTBot", "MyCustomMonitor/1.0"])
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

# Account-level container registry for prebuilt App Platform images (CI builds +
# pushes; App Platform pulls). Repos are created on first push, named
# lax-<env>-<component>. Opt-in via create_container_registry (see variables.tf).
resource "digitalocean_container_registry" "this" {
  count = var.create_container_registry ? 1 : 0
  name  = var.container_registry_name
  # NOTE: DOCR is unavailable in lon1 (the app region); fra1 is the nearest EU option.
  subscription_tier_slug = var.container_registry_subscription_tier
  region                 = var.container_registry_region
}
