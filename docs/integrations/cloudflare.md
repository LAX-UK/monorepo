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
- Rate limit `/.well-known/*`: **100 req/min/IP**.
- Rate limit `/api/auth/sign-up`: **10 req/min/IP**, 60s mitigation
  (`signup_rpm` variable).
- Rate limit `/api/auth/send-verification-email`: **5 req/min/IP**, 60s
  mitigation (`send_verification_email_rpm` variable).
- Rate limit `/webhooks/postmark`: **500 req/min/IP**, 60s mitigation
  (`postmark_webhook_rpm` variable) — sized for Postmark's delivery-event
  bursts.
- Keep provider-aware limits for any future `/webhooks/*`; Shopify retries on
  non-2xx so prefer 429 only on obvious abuse.
- Do not cache `/api/auth/*`, `/webhooks/*`, `/users/*`, `/bids/*`.
