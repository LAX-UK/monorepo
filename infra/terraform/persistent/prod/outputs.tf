output "environment" { value = local.environment }

output "digitalocean_project_id" {
  value       = module.project.id
  description = "Assign ephemeral DB/App resources here (see infra/terraform/ephemeral)."
}
