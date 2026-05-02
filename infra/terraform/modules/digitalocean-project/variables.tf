variable "name" {
  type = string
}
variable "description" {
  type = string
}
variable "environment" {
  type = string
}
variable "resource_urns" {
  type    = list(string)
  default = []
}
