# cloudflare-domain

Manages host-scoped DNS records, Cloudflare zone settings, OIDC cache rules, auth/webhook rate limits, and auth WAF rules.

Rate-limit rules (zone phase `http_ratelimit`):

The Cloudflare Free plan caps the `http_ratelimit` phase at **one rule per zone**
(API error code `50001`). To stay on Free while protecting the highest-stakes
production endpoints, the module declares a single auth abuse guard and pushes
lower-priority paths to app-layer middleware.

- `/api/auth/sign-up` and `/api/auth/send-verification-email` on `auth_hosts`:
  shared bucket derived from `min(signup_rpm, send_verification_email_rpm)`
  (defaults 10 and 5 → effective **5 req/min/IP** intent). On **Cloudflare Free**,
  the `http_ratelimit` phase only allows a **10 second** evaluation window; the
  module maps RPM into `max(1, ceil(rpm * 10 / 60))` requests per 10s, with
  **10s mitigation** (Free tier requires mitigation_timeout 10). On **Pro**, restore commit `a8027e39` for 60s windows, longer mitigation, and per-path rules.
- `/webhooks/postmark` and `/.well-known/*`: rate-limited at the app layer
  (`apps/api/src/middleware/rate-limit.ts`) on Free. The `postmark_webhook_rpm`
  variable is kept as a forward-compatible knob for when the zone moves to
  Cloudflare Pro (10 rules in this phase) and the per-path edge rules are
  restored from git history (commit `a8027e39`).

**Bot allowlist:** `whitelisted_bot_user_agents` + optional `cf.client.bot` match a
Skip rule with `action_parameters { ruleset = "current", phases = ["http_ratelimit"] }`.
Do not add `http.user_agent` to `http_ratelimit` expressions (Advanced Rate Limiting).
**Do not use `matches`** (regex) on Free — use `test_hosts` with explicit hostnames for test noindex.

**Plan limits:** Regex (`matches`) requires Business or WAF Advanced; UA in rate-limit rules requires Advanced Rate Limiting. DNS (TXT/MX) works on Free.
