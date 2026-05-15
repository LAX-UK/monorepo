output "bucket_name" { value = digitalocean_spaces_bucket.this.name }
output "cdn_domain_name" { value = "${digitalocean_spaces_bucket.this.name}.${var.region}.cdn.digitaloceanspaces.com" }
output "cdn_endpoint_id" { value = digitalocean_cdn.this.id }
output "cdn_endpoint" { value = digitalocean_cdn.this.endpoint }
