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
variable "name" {
  type = string
}
variable "environment" {
  type = string
}
variable "region" {
  type = string
}
variable "size" {
  type = string
}
variable "node_count" {
  type = number
}
variable "redis_version" {
  type    = string
  default = "7"
}
variable "allowed_sources" {
  type    = list(string)
  default = []
}
