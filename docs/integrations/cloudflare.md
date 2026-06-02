# Cloudflare

The full Cloudflare configuration is declared in
[infra/terraform/modules/cloudflare-domain/](../../infra/terraform/modules/cloudflare-domain/)
and applied from `infra/terraform/persistent/<env>/` (DNS, zone settings, WAF,
and edge rate limits). This page is the human-readable reference; Terraform is the source of truth.

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
  shared bucket targeting `min(signup_rpm, send_verification_email_rpm)` req/min/IP
  (defaults 10 and 5 → **5 req/min/IP** intent). **Free tier** only allows a **10s**
  rate-limit window in `http_ratelimit`; Terraform sets `period = 10` and
  `requests_per_period = max(1, ceil(rpm * 10 / 60))` (defaults → **1** request per
  10s per IP/colo, **10s** mitigation — Free requires `mitigation_timeout` 10). **Pro** can restore 60s windows,
  longer mitigation, and per-path rules (commit `a8027e39`).

### App layer (Hono middleware on `api_hosts`)

- `/webhooks/postmark`: see `apps/api/src/middleware/rate-limit.ts`. Postmark
  delivers from a small known IP set, so app-layer limits are sufficient until
  edge enforcement is restored. The `postmark_webhook_rpm` Terraform variable
  is reserved for when the zone moves to Pro.
- `/.well-known/*`: handled by app-layer middleware; the cache-edge rule above
  still absorbs steady-state read traffic.
- Keep provider-aware limits for any future `/webhooks/*` (e.g. Shopify retries
  on non-2xx, so prefer 429 only on obvious abuse).

### Bot allowlist (Free plan)

Terraform skips auth WAF challenges and the single auth rate-limit rule for:

- `cf.client.bot` when `whitelist_cf_client_bot = true` (default)
- Any `http.user_agent` containing a substring in `whitelisted_bot_user_agents`

Default substrings (module [`cloudflare-domain/variables.tf`](../../infra/terraform/modules/cloudflare-domain/variables.tf)):

| Category | Examples |
|----------|----------|
| SEO | `Googlebot`, `bingbot`, `Applebot`, `YandexBot`, `SemrushBot`, `AhrefsBot`, … |
| LLM / AI | `GPTBot`, `ChatGPT-User`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `Bytespider`, `CCBot`, … |
| Social preview | `LinkedInBot`, `facebookexternalhit`, `Twitterbot`, `Slackbot`, … |
| Monitoring | `Pingdom`, `UptimeRobot`, `StatusCake`, `DatadogSynthetics`, … |

These rules only apply on **`auth_hosts`** (sign-up / verify-email rate limit and `/api/auth/authorize` challenge). They do not replace **`robots.txt`** on the marketing site if you want to disallow LLM training crawlers on public pages.

To add or remove bots for `lax.bid`, set `whitelisted_bot_user_agents` on the `cloudflare_domain` module in [`persistent/prod/main.tf`](../../infra/terraform/persistent/prod/main.tf) (replaces the module default set entirely). Uses `contains` / `eq` only — **not** `matches` (regex requires Business or WAF Advanced).

**Bot Fight Mode** (dashboard toggle on Free) cannot be bypassed with Skip rules; turn it off or upgrade to Pro+ for Super Bot Fight Mode exceptions.

### Test hostnames (noindex)

`test_hosts` sets `X-Robots-Tag: noindex` on listed hostnames via explicit `http.host eq` checks (Free-safe). Do not use `matches` in expressions on a Free zone.

### Restoring per-path edge rules (post Pro upgrade)

When `lax.bid` is upgraded to Cloudflare Pro (10 rules in `http_ratelimit`),
restore the four-rule layout from commit `a8027e39` in
`infra/terraform/modules/cloudflare-domain/main.tf` and reapply.
