# cloudflare-domain

Manages host-scoped DNS records, Cloudflare zone settings, OIDC cache rules, auth/webhook rate limits, and auth WAF rules.

Rate-limit rules (zone phase `http_ratelimit`):

The Cloudflare Free plan caps the `http_ratelimit` phase at **one rule per zone**
(API error code `50001`). To stay on Free while protecting the highest-stakes
production endpoints, the module declares a single auth abuse guard and pushes
lower-priority paths to app-layer middleware.

- `/api/auth/sign-up` and `/api/auth/send-verification-email` on `auth_hosts`:
  shared bucket at `min(signup_rpm, send_verification_email_rpm)` req/min/IP
  (defaults: 10 and 5 → effective 5 RPM/IP), 60s mitigation. Using the more
  restrictive of the two preserves the verification-email policy when the same
  attacker rotates between endpoints.
- `/webhooks/postmark` and `/.well-known/*`: rate-limited at the app layer
  (`apps/api/src/middleware/rate-limit.ts`) on Free. The `postmark_webhook_rpm`
  variable is kept as a forward-compatible knob for when the zone moves to
  Cloudflare Pro (10 rules in this phase) and the per-path edge rules are
  restored from git history (commit `a8027e39`).
