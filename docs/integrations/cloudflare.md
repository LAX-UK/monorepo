# Cloudflare

## DNS

- `thealx.bid` → Next.js web component
- `api.thealx.bid` → Hono API component
- `auth.thealx.bid` → auth component (or API component before P2.5 split)
- `ws.thealx.bid` → Socket.IO gateway
- `thealx.art` → Hostgator WordPress
- `thealx.shop` → Shopify

## TLS

Use Full (strict). Provision origin certificates for DigitalOcean App Platform domains before enabling OIDC discovery.

## Cache and WAF

- `/.well-known/*`: cache 200s for ≤60s; bypass cache for non-200 responses.
- Rate limit `/.well-known/*`: **100 req/min/IP**.
- Rate limit `/api/auth/*`: start at 5 sign-in attempts / 15 min / IP.
- Rate limit `/webhooks/*`: provider-aware limits; Shopify retries on non-2xx so prefer 429 only on obvious abuse.
- Do not cache `/api/auth/*`, `/webhooks/*`, `/users/*`, `/bids/*`.
