output "zone_id" { value = data.cloudflare_zone.this.id }
output "records" { value = { for key, record in cloudflare_record.subdomain : key => record.hostname } }
