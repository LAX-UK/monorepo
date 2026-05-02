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
