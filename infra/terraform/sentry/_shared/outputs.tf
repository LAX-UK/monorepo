output "apps" {
  description = "App catalog: platform, sample rates, latency thresholds."
  value       = local.apps
}

output "routing" {
  description = "Per-environment alert severity routing keys."
  value       = local.routing
}

output "worker_crons" {
  description = "Worker cron monitor definitions (slug → schedule metadata)."
  value       = local.worker_crons
}

output "inbound_filters" {
  description = "Inbound data filter IDs applied to every project."
  value       = local.inbound_filters
}
