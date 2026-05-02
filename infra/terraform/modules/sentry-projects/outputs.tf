output "project_ids" { value = { for key, project in sentry_project.this : key => project.id } }
output "project_slugs" { value = { for key, project in sentry_project.this : key => project.slug } }
