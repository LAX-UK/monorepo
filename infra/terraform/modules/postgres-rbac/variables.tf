terraform {
  required_version = "= 1.9.8"

  required_providers {
    digitalocean = { source = "digitalocean/digitalocean", version = "= 2.43.0" }
    cloudflare   = { source = "cloudflare/cloudflare", version = "= 4.45.0" }
    postgresql   = { source = "cyrilgdn/postgresql", version = "= 1.23.0" }
    sentry       = { source = "jianyuan/sentry", version = "= 0.13.0" }
    random       = { source = "hashicorp/random", version = "~> 3.6" }
    time         = { source = "hashicorp/time", version = "~> 0.11" }
    null         = { source = "hashicorp/null", version = "~> 3.2" }
    local        = { source = "hashicorp/local", version = "~> 2.5" }
  }
}
variable "database_url_owner" {
  type      = string
  sensitive = true
}
variable "database_name" {
  type = string
}
variable "roles" {
  type = map(object({
    password = string
  }))
  sensitive = true
}
variable "schema_name" {
  type    = string
  default = "public"
}
