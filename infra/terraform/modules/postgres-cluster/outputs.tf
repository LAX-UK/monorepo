output "id" { value = digitalocean_database_cluster.this.id }
output "urn" { value = digitalocean_database_cluster.this.urn }
output "host" { value = digitalocean_database_cluster.this.host }
output "port" { value = digitalocean_database_cluster.this.port }
output "database_name" { value = digitalocean_database_db.auction.name }
output "owner_uri" {
  value     = digitalocean_database_cluster.this.uri
  sensitive = true
}
