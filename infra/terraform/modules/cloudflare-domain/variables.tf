variable "zone_name" {
  type = string
}
variable "account_id" {
  type = string
}
variable "environment" {
  type = string
}
variable "security_level" {
  type = string
}
variable "subdomains" {
  type = map(object({
    name    = string
    type    = string
    value   = string
    proxied = bool
    comment = string
  }))
}
variable "auth_hosts" {
  type = set(string)
}
variable "api_hosts" {
  type = set(string)
}

variable "postmark_webhook_rpm" {
  type    = number
  default = 500
}

variable "signup_rpm" {
  type    = number
  default = 10
}

variable "send_verification_email_rpm" {
  type    = number
  default = 5
}
