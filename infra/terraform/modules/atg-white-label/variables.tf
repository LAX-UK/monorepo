variable "account_id" {
  type        = string
  description = "Cloudflare account that owns the Worker script."
}

variable "zone_id" {
  type        = string
  description = "Cloudflare zone of the parent domain."
}

variable "zone_name" {
  type        = string
  description = "Parent domain, e.g. lax.bid."
}

variable "record_name" {
  type        = string
  default     = "auctions"
  description = "Subdomain label for the White Label."
}

variable "origin" {
  type        = string
  description = "ATG White Label hostname the subdomain points at."
}

variable "acm_validation" {
  type = object({
    name  = string
    value = string
  })
  description = "ACM DNS validation CNAME that ATG supplied for the White Label certificate."
}

variable "worker_name" {
  type        = string
  default     = "atg-cookie-shield"
  description = "Cloudflare Worker script name."
}

variable "acm_validation_enabled" {
  type        = bool
  default     = false
  description = "Create the ACM validation CNAME (DNS-only; browsers never visit it)."
}

variable "enabled" {
  type        = bool
  default     = false
  description = "Publish the White Label hostname, proxied through the cookie-shield Worker."
}
