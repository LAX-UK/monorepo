# Cloudflare DNS and edge

## Symptom

- `522`/`525` to origin; certificate warnings; new subdomain not resolving; rate limits too aggressive; www redirect broken.

## Diagnosis

1. **DNS propagation** — `dig +short api.lax.bid CNAME` vs expected App Platform hostname.
   Also verify `auth.lax.bid`, `ws.lax.bid`, `www.thelax.art`, and `shop.lax.art`
   against Terraform. Marketing is static initially; Shop is the custom product.
   `thelax.art`, `lax.art` and `www.lax.art` are redirect-only hosts (301 to
   `https://www.thelax.art` + path); see [lax-art-production-launch.md](./lax-art-production-launch.md#host-redirects-cloudflare-http_request_dynamic_redirect).
2. **SSL mode** — Terraform sets **Full (strict)** (`cloudflare_zone_settings_override`); origin must present valid cert (DO App Platform handles this).
3. **Rulesets** — Cloudflare dashboard → **Security → WAF** / **Rules** for recent changes.

## Resolution

| Issue | Action |
|-------|--------|
| Wrong CNAME | Fix `infra/terraform/persistent/*/main.tf` `subdomains` map; `terraform apply` persistent stack. |
| Cert expiry | DO auto-renews; if custom cert, upload renewed chain. |
| Rate limit false positives | Loosen specific rule in `infra/terraform/modules/cloudflare-domain/main.tf` + align `docs/integrations/cloudflare.md`. |
| www redirect | `cloudflare_ruleset.www_redirect` — verify expression matches `www.lax.bid`. LAX Art is the reverse: apex `thelax.art` and `lax.art`/`www.lax.art` → `https://www.thelax.art` (never redirect `www.thelax.art` itself). |
| Legacy thelax.art URL 404s | Art middleware logs `legacy_redirect_miss`; add the path to `legacy-redirects.json` per [thelax-seo-migration.md](./thelax-seo-migration.md). Do not add Cloudflare page rules for individual legacy paths. |
| Identity receiver redirects/caching | Exclude back-channel logout and SSF receiver paths from redirects and cache; they must reach the exact registered HTTPS endpoint. |

After DNS changes, verify discovery still reports issuer
`https://auth.lax.bid`, each RP callback remains exact, and cookies from
Identity, Bid, and Shop have no `Domain` attribute.

## Escalation

- Cloudflare support for DNS propagation &gt; 24h after correct NS delegation.

## Related

- [docs/integrations/cloudflare.md](../integrations/cloudflare.md)
