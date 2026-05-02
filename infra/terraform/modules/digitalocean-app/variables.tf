variable "name" {
  type = string
}
variable "environment" {
  type = string
}
variable "region" {
  type = string
}
variable "repository_clone_url" {
  type = string
}
variable "branch" {
  type = string
}
variable "components" {
  type = list(object({
    name              = string
    kind              = string
    source_dir        = string
    dockerfile_path   = string
    run_command       = optional(string)
    http_port         = optional(number)
    instance_size     = string
    instance_count    = number
    health_check_path = optional(string)
    domain            = optional(string)
    primary_domain    = optional(bool, false)
    env = list(object({
      key   = string
      value = string
      type  = string
      scope = string
    }))
  }))
  sensitive = true
}
