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

variable "signup_rpm" {
  type    = number
  default = 10
}

variable "send_verification_email_rpm" {
  type    = number
  default = 5
}

# Reserved: Cloudflare Free caps http_ratelimit at 1 rule per zone and restricts
# period and mitigation_timeout to 10s in that phase; the postmark webhook is
# rate-limited at the app layer for now. Kept as a variable so a future Pro-plan
# upgrade can re-enable a /webhooks/postmark edge rule without a breaking
# interface change.
variable "postmark_webhook_rpm" {
  type    = number
  default = 500
}

# Zone-level WAF / rate-limit rulesets exist once per Cloudflare zone per phase.
# Only one stack (e.g. persistent/prod) should manage them when test and prod share lax.bid.
variable "manage_firewall_rulesets" {
  type    = bool
  default = true
}
