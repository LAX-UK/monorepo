output "uptime_check_ids" { value = { for key, check in digitalocean_uptime_check.target : key => check.id } }
