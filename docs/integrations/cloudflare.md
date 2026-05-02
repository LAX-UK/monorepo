# Cloudflare

## DNS

- `lax.bid` → Next.js web component
- `api.lax.bid` → Hono API component
- `auth.lax.bid` → auth component (or API component before P2.5 split)
- `ws.lax.bid` → Socket.IO gateway
- `lax.art` → Hostgator WordPress
- `lax.shop` → Shopify

## TLS

Use Full (strict). Provision origin certificates for DigitalOcean App Platform domains before enabling OIDC discovery.

## Cache and WAF

- `/.well-known/*`: cache 200s for ≤60s; bypass cache for non-200 responses.
- Rate limit `/.well-known/*`: **100 req/min/IP**.
- Rate limit `/api/auth/*`: start at 5 sign-in attempts / 15 min / IP.
- Rate limit `/webhooks/*`: provider-aware limits; Shopify retries on non-2xx so prefer 429 only on obvious abuse.
- Do not cache `/api/auth/*`, `/webhooks/*`, `/users/*`, `/bids/*`.
