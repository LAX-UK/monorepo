output "slugs" {
  description = "Fully-qualified Sentry cron monitor slugs for worker check-ins."
  value       = local.slugs
}

output "schedules" {
  description = "Cron schedule metadata keyed by slug (for SDK upsert)."
  value       = var.worker_crons
}
