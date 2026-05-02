terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = {
      source  = "digitalocean/digitalocean"
      version = "= 2.85.0"
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
locals { tags = ["environment:${var.environment}", "managed_by:terraform"] }

resource "digitalocean_database_cluster" "this" {
  name       = var.name
  engine     = "pg"
  version    = var.postgres_version
  size       = var.size
  region     = var.region
  node_count = var.node_count
  tags       = local.tags
}

resource "digitalocean_database_db" "auction" {
  cluster_id = digitalocean_database_cluster.this.id
  name       = var.database_name
}

resource "digitalocean_database_firewall" "this" {
  count      = length(var.allowed_sources) > 0 ? 1 : 0
  cluster_id = digitalocean_database_cluster.this.id
  dynamic "rule" {
    for_each = var.allowed_sources
    content {
      type  = "app"
      value = rule.value
    }
  }
}

# DO Managed Postgres terminates TLS with a private CA. Newer pg/pg-connection-string
# treat sslmode=require as verify-full, so apps must trust this CA explicitly.
data "digitalocean_database_ca" "this" {
  cluster_id = digitalocean_database_cluster.this.id
}
