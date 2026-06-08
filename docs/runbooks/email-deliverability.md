# Email deliverability (lax.bid)

Transactional and broadcast mail use **Postmark** from `mail.lax.bid` (prod) and `mail.test.lax.bid` (test). DNS is managed in Terraform (`infra/terraform/persistent/*/main.tf`).

## Current DNS (Terraform-managed)

| Record | Type | Purpose |
|--------|------|---------|
| `202605…pm._domainkey.mail` | TXT | Postmark DKIM (rotate when Postmark rotates keys) |
| `pm-bounces.mail` | CNAME | Postmark Return-Path (`pm.mtasv.net`) |
| `mail` | TXT | SPF `v=spf1 include:spf.mtasv.net ~all` |
| `_dmarc.mail` | TXT | DMARC aggregate reports to `support@lax.bid` |

Verify in shell:

```bash
dig +short TXT mail.lax.bid
dig +short TXT _dmarc.mail.lax.bid
dig +short CNAME pm-bounces.mail.lax.bid
```

## mail-tester.com drill

1. Send a real message from Postmark (or app-triggered mail) **to** the unique address mail-tester provides.
2. Record **score /10** and PDF link here after each quarterly check:

| Date | From address | Score | Notes |
|------|--------------|-------|-------|
| _pending_ | `no-reply@mail.lax.bid` | — | Run after DNS apply |

**Acceptance:** score **≥ 8/10** with no critical SPF/DKIM/DMARC failures.

## Zoho Mail (apex `lax.bid`)

Team inboxes (`support@`, `settlements@`, etc.) use **Zoho Mail** on the apex. App transactional mail stays on Postmark (`mail.lax.bid`); do not change Postmark records when adding Zoho.

| Record | Type | Purpose |
|--------|------|---------|
| `@` | TXT | Domain verify (`zoho_mail_verify`) |
| `@` | TXT | Google Postmaster / Search Console verify (`google_site_verify`) |
| `@` | MX | `mx.zoho.eu` (10), `mx2.zoho.eu` (20), `mx3.zoho.eu` (50) |
| `@` | TXT | SPF `v=spf1 include:zohomail.eu ~all` (`zoho_spf`) |
| `zmail._domainkey` | TXT | Zoho DKIM (`zoho_dkim`) |
| `_dmarc` | TXT | _Optional later_ — apex DMARC after `support@` is live |

Verify in shell:

```bash
dig +short MX lax.bid
dig +short TXT lax.bid
dig +short TXT zmail._domainkey.lax.bid
dig +short TXT lax.bid | grep zoho-verification
```

After apply, confirm green status in Zoho Mail → domain setup, then create `support@` and `settlements@` mailboxes.

## MX note (Postmark subdomain)

`mail.lax.bid` is a **sending** subdomain; **MX** is only required if you receive mail on that hostname (usually not for Postmark-only). Inbound team mail uses **MX on the apex** via Zoho Mail (see above).

## When to pause sending

- Postmark bounce rate &gt; 5% in a 1h window.
- Spam complaint rate spike in Postmark **Activity**.

## Escalation

- Postmark support with Message ID + server token last-4 reference.

## Stuck dual-confirm email change

Users can cancel an in-flight change from **Dashboard → Settings → Account** (clears `pending_new_email` via `DELETE /auth/change-email`). If UI is unavailable, clear manually: `pending_new_email`, `email_change_old_ok`, `email_change_new_ok`, `email_change_expires_at` on the `user` row.

## Related

- [Email provider incident](./email-provider-incident.md)
