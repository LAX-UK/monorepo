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

## MX note

`mail.lax.bid` is a **sending** subdomain; **MX** is only required if you receive mail on that hostname (usually not for Postmark-only). Workspace mail (e.g. Google) uses separate MX on the apex or `google._domainkey` — document separately if added.

## When to pause sending

- Postmark bounce rate &gt; 5% in a 1h window.
- Spam complaint rate spike in Postmark **Activity**.

## Escalation

- Postmark support with Message ID + server token last-4 reference.

## Related

- [Email provider incident](./email-provider-incident.md)
