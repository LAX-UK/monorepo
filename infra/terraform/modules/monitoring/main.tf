terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.43.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 4.45.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "= 1.23.0"
    }
    sentry = {
      source  = "jianyuan/sentry"
      version = "= 0.13.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}
resource "digitalocean_monitor_alert" "postgres_cpu" {
  alerts { email = [var.alert_email] }
  window      = "5m"
  type        = "v1/dbaas/alerts/cpu_alerts"
  compare     = "GreaterThan"
  value       = 80
  enabled     = true
  entities    = [var.postgres_cluster_id]
  description = "lax-${var.environment} Postgres CPU > 80%"
}

resource "digitalocean_monitor_alert" "redis_memory" {
  alerts { email = [var.alert_email] }
  window      = "5m"
  type        = "v1/dbaas/alerts/memory_utilization_alerts"
  compare     = "GreaterThan"
  value       = 80
  enabled     = true
  entities    = [var.redis_cluster_id]
  description = "lax-${var.environment} Redis memory > 80%"
}

resource "digitalocean_uptime_check" "target" {
  for_each = var.uptime_targets
  name     = "lax-${var.environment}-${each.key}"
  target   = each.value
  type     = "https"
  regions  = ["eu_west"]
  enabled  = true
}

resource "digitalocean_uptime_alert" "target" {
  for_each   = digitalocean_uptime_check.target
  name       = "lax-${var.environment}-${each.key}-down"
  check_id   = each.value.id
  type       = "down"
  period     = "5m"
  comparison = "greater_than"
  threshold  = 0
  notifications { email = [var.alert_email] }
}
