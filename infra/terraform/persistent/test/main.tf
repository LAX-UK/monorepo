locals {
  environment  = "test"
  region       = "lon1"
  zone_name    = "lax.bid"
  media_cdn    = "lax-media.lon1.cdn.digitaloceanspaces.com"
  app_hostname = "replace-after-app-platform-create.ondigitalocean.app"
  subdomains = {
    web   = { name = "test", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test web App Platform hostname" }
    api   = { name = "test-api", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test api App Platform hostname" }
    auth  = { name = "test-auth", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test auth App Platform hostname" }
    ws    = { name = "test-ws", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax test ws App Platform hostname" }
    media = { name = "test-media", type = "CNAME", value = local.media_cdn, proxied = true, comment = "lax test media CDN" }
  }
}

module "cloudflare_domain" {
  source         = "../../modules/cloudflare-domain"
  zone_name      = local.zone_name
  account_id     = var.cloudflare_account_id
  environment    = local.environment
  security_level = "medium"
  subdomains     = local.subdomains
  auth_hosts     = ["test-auth.lax.bid"]
  api_hosts      = ["test-api.lax.bid"]
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
