output "id" { value = digitalocean_database_cluster.this.id }
output "urn" { value = digitalocean_database_cluster.this.urn }
output "host" { value = digitalocean_database_cluster.this.host }
output "port" { value = digitalocean_database_cluster.this.port }
output "database_name" { value = digitalocean_database_db.auction.name }
output "owner_uri" {
  # `digitalocean_database_cluster.this.uri` auto-targets the cluster's `defaultdb`,
  # not our application database. Build the doadmin URI against the actual auction
  # database so the migrate Job creates tables (and per-database GRANTs) where the
  # api/auth/worker apps will read them.
  value     = "postgresql://${digitalocean_database_cluster.this.user}:${urlencode(digitalocean_database_cluster.this.password)}@${digitalocean_database_cluster.this.host}:${digitalocean_database_cluster.this.port}/${digitalocean_database_db.auction.name}?sslmode=require"
  sensitive = true
}
output "ca_certificate" {
  value     = data.digitalocean_database_ca.this.certificate
  sensitive = true
}
