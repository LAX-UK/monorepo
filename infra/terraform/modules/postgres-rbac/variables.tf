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

variable "table_owner_role" {
  type        = string
  default     = "doadmin"
  description = "Role that owns migrated tables (DigitalOcean admin user); default privileges apply to objects this role creates."
}
