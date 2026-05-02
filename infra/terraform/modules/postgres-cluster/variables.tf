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
variable "database_name" {
  type = string
}
variable "postgres_version" {
  type    = string
  default = "16"
}
variable "allowed_sources" {
  type    = list(string)
  default = []
}
