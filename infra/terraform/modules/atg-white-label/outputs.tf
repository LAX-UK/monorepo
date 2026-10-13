output "hostname" {
  value = var.enabled ? local.hostname : null
}
