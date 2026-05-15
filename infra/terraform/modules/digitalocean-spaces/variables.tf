variable "bucket_name" {
  type = string
}
variable "region" {
  type = string
}
variable "environment" {
  type = string
}
variable "cors_allowed_origins" {
  type = list(string)
}
variable "cdn_custom_domain" {
  type        = string
  default     = ""
  description = "Custom domain for the CDN endpoint (e.g. media.lax.bid). DNS must point directly to DO (not proxied) for Let's Encrypt."
}
