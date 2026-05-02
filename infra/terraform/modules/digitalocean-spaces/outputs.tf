output "bucket_name" { value = digitalocean_spaces_bucket.this.name }
output "cdn_domain_name" { value = "${digitalocean_spaces_bucket.this.name}.${var.region}.cdn.digitaloceanspaces.com" }
