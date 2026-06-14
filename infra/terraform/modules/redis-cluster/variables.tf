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
variable "engine" {
  type        = string
  default     = "valkey"
  description = "DigitalOcean Managed Caching engine (Valkey is the supported Redis-compatible option for new clusters)."
}

variable "engine_version" {
  type        = string
  default     = "8"
  description = "Major engine version; see DO /v2/databases/options (Valkey is currently v8)."
}
variable "allowed_sources" {
  type    = list(string)
  default = []
}

variable "eviction_policy" {
  type        = string
  default     = null
  description = "Valkey maxmemory-policy (e.g. noeviction for BullMQ). Null leaves DO default unchanged."
}
