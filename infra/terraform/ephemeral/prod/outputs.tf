terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "= 2.43.0" }
    cloudflare   = { source = "cloudflare/cloudflare", version = "= 4.45.0" }
    postgresql   = { source = "cyrilgdn/postgresql", version = "= 1.23.0" }
    sentry       = { source = "jianyuan/sentry", version = "= 0.13.0" }
    random       = { source = "hashicorp/random", version = "~> 3.6" }
    time         = { source = "hashicorp/time", version = "~> 0.11" }
    null         = { source = "hashicorp/null", version = "~> 3.2" }
    local        = { source = "hashicorp/local", version = "~> 2.5" }
  }
}
output "environment" {
  value = local.environment
}
output "app_id" {
  value = module.app.id
}
output "postgres_owner_uri" {
  value     = module.postgres.owner_uri
  sensitive = true
}
output "redis_uri" {
  value     = module.redis.uri
  sensitive = true
}
output "database_url_auth" {
  value     = local.database_url_auth
  sensitive = true
}
output "database_url_api" {
  value     = local.database_url_api
  sensitive = true
}
output "database_url_worker" {
  value     = local.database_url_worker
  sensitive = true
}
