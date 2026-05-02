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
locals {
  role_names = toset(keys(nonsensitive(var.roles)))
}

resource "postgresql_role" "app" {
  for_each = local.role_names
  name     = each.key
  login    = true
  password = var.roles[each.key].password
}

resource "postgresql_grant" "schema_usage" {
  for_each    = local.role_names
  database    = var.database_name
  role        = postgresql_role.app[each.key].name
  schema      = var.schema_name
  object_type = "schema"
  privileges  = ["USAGE"]
}

# Table grants cannot run before Drizzle migrations create relations (and revokes fail if tables
# are missing). Default privileges apply when doadmin runs migrations and creates objects.
locals {
  table_privileges_full = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
  sequence_privileges   = ["USAGE", "SELECT"]
}

resource "postgresql_default_privileges" "app_tables" {
  for_each = local.role_names

  database    = var.database_name
  schema      = var.schema_name
  role        = postgresql_role.app[each.key].name
  owner       = var.table_owner_role
  object_type = "table"
  privileges  = local.table_privileges_full
}

resource "postgresql_default_privileges" "app_sequences" {
  for_each = local.role_names

  database    = var.database_name
  schema      = var.schema_name
  role        = postgresql_role.app[each.key].name
  owner       = var.table_owner_role
  object_type = "sequence"
  privileges  = local.sequence_privileges
}
