output "project_id" {
  description = "Sentry project ID."
  value       = sentry_project.this.id
}

output "project_slug" {
  description = "Sentry project slug."
  value       = sentry_project.this.slug
}

output "project_internal_id" {
  description = "Sentry project internal ID."
  value       = sentry_project.this.internal_id
}

output "dsn_public" {
  description = "Public DSN for SDK init."
  value       = sentry_key.this.dsn["public"]
  sensitive   = true
}
