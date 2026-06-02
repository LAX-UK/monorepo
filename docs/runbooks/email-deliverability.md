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

| Record | Type | Status |
|--------|------|--------|
| `@` | TXT | `zoho-verification=zb23174584.zmverify.zoho.eu` (domain verify; Terraform `zoho_mail_verify`) |
| `@` | MX | _Pending_ — add from Zoho Mail admin after TXT verify |
| `@` | TXT (SPF) | _Pending_ — Zoho SPF string from admin |
| Zoho DKIM host | TXT/CNAME | _Pending_ — from Zoho Mail → Email Configuration → DKIM |
| `_dmarc` | TXT | _Pending_ — apex DMARC after workspace send is live |

Verify domain ownership:

```bash
dig +short TXT lax.bid | grep zoho-verification
```

After Zoho shows MX/SPF/DKIM values, add them to `infra/terraform/persistent/prod/main.tf` and apply `persistent` prod (same workflow as Postmark rows above).

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
