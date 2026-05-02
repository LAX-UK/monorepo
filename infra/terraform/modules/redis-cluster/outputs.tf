output "id" { value = digitalocean_database_cluster.this.id }
output "urn" { value = digitalocean_database_cluster.this.urn }
output "uri" {
  value     = digitalocean_database_cluster.this.uri
  sensitive = true
}
