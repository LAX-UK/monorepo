output "dsns" {
  description = "Public DSN per app key."
  value       = { for k, m in module.app_projects : k => m.dsn_public }
  sensitive   = true
}

output "project_slugs" {
  description = "Sentry project slug per app key."
  value       = { for k, m in module.app_projects : k => m.project_slug }
}

output "app_config" {
  description = "Sample rates and platform metadata per app."
  value       = module.catalog.apps
}

output "cron_slugs" {
  description = "Worker cron monitor slugs."
  value       = try(module.worker_crons[0].slugs, {})
}
