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
| `_dmarc` | TXT | Apex DMARC `v=DMARC1; p=none;` (`apex_dmarc`) — see Mailchimp section |

Verify in shell:

```bash
dig +short MX lax.bid
dig +short TXT lax.bid
dig +short TXT zmail._domainkey.lax.bid
dig +short TXT lax.bid | grep zoho-verification
```

After apply, confirm green status in Zoho Mail → domain setup, then create `support@` and `settlements@` mailboxes.

## Mailchimp (apex `lax.bid`)

Mailchimp domain authentication for marketing sends from the apex domain. The DKIM CNAMEs
point at Mailchimp-hosted keys (`mcsv.net`), so Mailchimp can rotate them without DNS changes.
All records are DNS-only (`proxied = false`) and declared in
`infra/terraform/persistent/prod/main.tf`.

> **Note:** `mcsv.net` is **Mailchimp**, not Mailgun — confirm Mailchimp is the service being
> onboarded. Keep these apart from the Postmark transactional setup on `mail.lax.bid`.

| Record | Type | Cloudflare name | Purpose |
|--------|------|-----------------|---------|
| Apex DMARC | TXT | `_dmarc` | `v=DMARC1; p=none;` (`apex_dmarc`) — org-level policy for `lax.bid` |
| DKIM (k2) | CNAME | `k2._domainkey` | `dkim2.mcsv.net` (`mailchimp_dkim_2`) |
| DKIM (k3) | CNAME | `k3._domainkey` | `dkim3.mcsv.net` (`mailchimp_dkim_3`) |

Both the DMARC TXT **and** the DKIM CNAMEs are required: the TXT only declares policy, while
the CNAMEs are what actually let Mailchimp sign mail and pass authentication.

The apex `_dmarc` is shared org-level policy (separate from `_dmarc.mail` and `_dmarc.news`).
Currently `p=none` (monitor only); consider adding `rua=mailto:support@lax.bid` for visibility.

Verify in shell:

```bash
dig +short TXT _dmarc.lax.bid
dig +short CNAME k2._domainkey.lax.bid
dig +short CNAME k3._domainkey.lax.bid
```

After apply, refresh Mailchimp → domain authentication until DKIM shows verified, then send a
seed campaign and confirm **DKIM=pass** / **DMARC=pass** in the message headers.

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
