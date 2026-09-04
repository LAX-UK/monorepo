# Cloudflare DNS and edge

## Symptom

- `522`/`525` to origin; certificate warnings; new subdomain not resolving; rate limits too aggressive; www redirect broken.

## Diagnosis

1. **DNS propagation** — `dig +short api.lax.bid CNAME` vs expected App Platform hostname.
   Also verify `auth.lax.bid`, `ws.lax.bid`, `lax.art`, and `shop.lax.art`
   against Terraform. Marketing is static initially; Shop is the custom product.
2. **SSL mode** — Terraform sets **Full (strict)** (`cloudflare_zone_settings_override`); origin must present valid cert (DO App Platform handles this).
3. **Rulesets** — Cloudflare dashboard → **Security → WAF** / **Rules** for recent changes.

## Resolution

| Issue | Action |
|-------|--------|
| Wrong CNAME | Fix `infra/terraform/persistent/*/main.tf` `subdomains` map; `terraform apply` persistent stack. |
| Cert expiry | DO auto-renews; if custom cert, upload renewed chain. |
| Rate limit false positives | Loosen specific rule in `infra/terraform/modules/cloudflare-domain/main.tf` + align `docs/integrations/cloudflare.md`. |
| www redirect | `cloudflare_ruleset.www_redirect` — verify expression matches `www.lax.bid`. |
| Identity receiver redirects/caching | Exclude back-channel logout and SSF receiver paths from redirects and cache; they must reach the exact registered HTTPS endpoint. |

After DNS changes, verify discovery still reports issuer
`https://auth.lax.bid`, each RP callback remains exact, and cookies from
Identity, Bid, and Shop have no `Domain` attribute.

## Escalation

- Cloudflare support for DNS propagation &gt; 24h after correct NS delegation.

## Related

- [docs/integrations/cloudflare.md](../integrations/cloudflare.md)
