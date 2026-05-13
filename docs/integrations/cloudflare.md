# Cloudflare

The full Cloudflare configuration is declared in
[infra/terraform/modules/cloudflare-domain/](../../infra/terraform/modules/cloudflare-domain/)
and applied per environment from `infra/terraform/persistent/<env>/` (DNS,
zone settings) and `infra/terraform/ephemeral/<env>/` (rate limits, WAF rules).
This page is the human-readable reference; Terraform is the source of truth.

## DNS

| Hostname | Production | Test |
|---|---|---|
| Web (Next.js) | `lax.bid` | `test.lax.bid` |
| API (Hono) | `api.lax.bid` | `test-api.lax.bid` |
| Auth (OIDC issuer; D7 dual-stack with API today) | `auth.lax.bid` | `test-auth.lax.bid` |
| WebSocket gateway | `ws.lax.bid` | `test-ws.lax.bid` |
| Media CDN (Spaces) | `media.lax.bid` | `test-media.lax.bid` |
| WordPress marketing (Hostgator) | `lax.art` | — |
| Shopify storefront | `lax.shop` | — |

## TLS

Full (strict) TLS. DigitalOcean provisions Let's Encrypt origin certificates
for the App Platform domains; Cloudflare verifies the chain on every request.

## Cache and WAF

- `/.well-known/*`: cache 200s for ≤60s; bypass cache for non-200 responses.
- Do not cache `/api/auth/*`, `/webhooks/*`, `/users/*`, `/bids/*`.

## Rate limiting

The `lax.bid` zone runs on the Cloudflare **Free** plan, which allows
**one rule** in the `http_ratelimit` phase (API error `50001` is raised on the
second rule). Production protection takes the slot; lower-priority paths are
guarded at the app layer until the zone is upgraded.

### Edge (Cloudflare, single rule)

- `/api/auth/sign-up` and `/api/auth/send-verification-email` on `auth_hosts`:
  shared bucket at `min(signup_rpm, send_verification_email_rpm)` req/min/IP
  (defaults 10 and 5 → effective **5 req/min/IP**), 60s mitigation. The shared
  bucket prevents an attacker from rotating across both endpoints to double
  their effective quota. Variables: `signup_rpm`,
  `send_verification_email_rpm`.

### App layer (Hono middleware on `api_hosts`)

- `/webhooks/postmark`: see `apps/api/src/middleware/rate-limit.ts`. Postmark
  delivers from a small known IP set, so app-layer limits are sufficient until
  edge enforcement is restored. The `postmark_webhook_rpm` Terraform variable
  is reserved for when the zone moves to Pro.
- `/.well-known/*`: handled by app-layer middleware; the cache-edge rule above
  still absorbs steady-state read traffic.
- Keep provider-aware limits for any future `/webhooks/*` (e.g. Shopify retries
  on non-2xx, so prefer 429 only on obvious abuse).

### Restoring per-path edge rules (post Pro upgrade)

When `lax.bid` is upgraded to Cloudflare Pro (10 rules in `http_ratelimit`),
restore the four-rule layout from commit `a8027e39` in
`infra/terraform/modules/cloudflare-domain/main.tf` and reapply.
