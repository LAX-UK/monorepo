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

locals {
  auth_full_tables   = toset(["user", "session", "account", "verification", "jwks_key", "external_accounts", "oauth_application", "oauth_access_token", "oauth_consent"])
  api_read_tables    = toset(["user"])
  worker_read_tables = toset(["domain_events", "user"])
  worker_full_tables = toset(["projector_state", "webhook_event", "upload_object"])
}

resource "postgresql_grant" "auth_tables" {
  for_each    = local.auth_full_tables
  database    = var.database_name
  role        = postgresql_role.app["auth_app"].name
  schema      = var.schema_name
  object_type = "table"
  objects     = [each.value]
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
}

resource "postgresql_grant" "api_read_tables" {
  for_each    = local.api_read_tables
  database    = var.database_name
  role        = postgresql_role.app["api_app"].name
  schema      = var.schema_name
  object_type = "table"
  objects     = [each.value]
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "worker_read_tables" {
  for_each    = local.worker_read_tables
  database    = var.database_name
  role        = postgresql_role.app["worker_app"].name
  schema      = var.schema_name
  object_type = "table"
  objects     = [each.value]
  privileges  = ["SELECT"]
}

resource "postgresql_grant" "worker_full_tables" {
  for_each    = local.worker_full_tables
  database    = var.database_name
  role        = postgresql_role.app["worker_app"].name
  schema      = var.schema_name
  object_type = "table"
  objects     = [each.value]
  privileges  = ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"]
}

resource "postgresql_grant" "sequences" {
  for_each    = local.role_names
  database    = var.database_name
  role        = postgresql_role.app[each.key].name
  schema      = var.schema_name
  object_type = "sequence"
  privileges  = ["USAGE", "SELECT"]
}
