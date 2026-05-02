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
