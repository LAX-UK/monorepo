output "environment" { value = local.environment }

output "digitalocean_project_id" {
  value       = module.project.id
  description = "Assign ephemeral DB/App resources here (see infra/terraform/ephemeral)."
}

output "container_registry_name" {
  value       = one(digitalocean_container_registry.this[*].name)
  description = "DOCR registry name (null until create_container_registry = true). Used by .github/workflows/build-images.yml as the push target registry.digitalocean.com/<name>/lax-<env>-<component>."
}

output "container_registry_endpoint" {
  value       = one(digitalocean_container_registry.this[*].endpoint)
  description = "DOCR endpoint host (null until the registry is created)."
}
