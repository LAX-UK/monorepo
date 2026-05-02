terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.43.0"
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

locals {
  environment  = "prod"
  region       = "lon1"
  zone_name    = "lax.bid"
  media_cdn    = "lax-media.lon1.cdn.digitaloceanspaces.com"
  app_hostname = "replace-after-app-platform-create.ondigitalocean.app"
  subdomains = {
    web   = { name = "@", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod web App Platform hostname" }
    api   = { name = "api", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod api App Platform hostname" }
    auth  = { name = "auth", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod auth App Platform hostname" }
    ws    = { name = "ws", type = "CNAME", value = local.app_hostname, proxied = true, comment = "lax prod ws App Platform hostname" }
    media = { name = "media", type = "CNAME", value = local.media_cdn, proxied = true, comment = "lax prod media CDN" }
  }
}

module "cloudflare_domain" {
  source         = "../../modules/cloudflare-domain"
  zone_name      = local.zone_name
  account_id     = var.cloudflare_account_id
  environment    = local.environment
  security_level = "high"
  subdomains     = local.subdomains
  auth_hosts     = ["auth.lax.bid"]
  api_hosts      = ["api.lax.bid"]
}

module "media" {
  source                      = "../../modules/digitalocean-spaces"
  bucket_name                 = "lax-media"
  region                      = local.region
  environment                 = local.environment
  cors_allowed_origins        = ["https://lax.bid", "https://api.lax.bid", "https://auth.lax.bid", "https://ws.lax.bid", "https://test.lax.bid", "https://test-api.lax.bid", "https://test-auth.lax.bid", "https://test-ws.lax.bid"]
  test_prefix_expiration_days = 7
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
