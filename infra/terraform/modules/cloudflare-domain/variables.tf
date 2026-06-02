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

# Test hostnames for edge noindex headers. Use explicit eq (not matches/regex) — regex
# requires Cloudflare Business or WAF Advanced on the zone.
variable "test_hosts" {
  type        = set(string)
  description = "Hostnames that receive X-Robots-Tag noindex (e.g. test.lax.bid, test-api.lax.bid)."
  default     = []
}

# Substrings matched against http.user_agent (contains). Used in the WAF Skip rule
# (http_request_firewall_custom) to bypass authorize challenges and http_ratelimit phase.
# Do not reference http.user_agent inside http_ratelimit rules — requires Advanced Rate Limiting.
variable "whitelisted_bot_user_agents" {
  type        = set(string)
  description = "User-Agent substrings for legitimate bots to bypass auth challenge and auth rate limit. Matched with contains (Free-plan safe)."
  default = [
    # Search / SEO
    "Googlebot",
    "AdsBot-Google",
    "Google-InspectionTool",
    "Google-Extended",
    "bingbot",
    "Applebot",
    "Applebot-Extended",
    "DuckDuckBot",
    "YandexBot",
    "Baiduspider",
    "Slurp",
    "SemrushBot",
    "AhrefsBot",
    "MJ12bot",
    "DotBot",
    "Pinterestbot",
    "PetalBot",
    "Sogou",
    "Amazonbot",
    # LLM / AI crawlers (training & preview; use robots.txt on web if you want to block indexing)
    "GPTBot",
    "ChatGPT-User",
    "OAI-SearchBot",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Bytespider",
    "CCBot",
    "cohere-ai",
    "meta-externalagent",
    "Diffbot",
    "YouBot",
    "MistralAI-User",
    # Social link preview
    "LinkedInBot",
    "Slackbot",
    "Twitterbot",
    "facebookexternalhit",
    "facebot",
    "WhatsApp",
    "TelegramBot",
    "Discordbot",
    # Uptime / synthetic monitoring
    "Pingdom",
    "UptimeRobot",
    "StatusCake",
    "Better Stack",
    "DatadogSynthetics",
  ]
}

variable "whitelist_cf_client_bot" {
  type        = bool
  description = "When true, also allow cf.client.bot (Cloudflare-known good bots) in bot allow expressions."
  default     = true
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
