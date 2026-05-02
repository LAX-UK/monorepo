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
