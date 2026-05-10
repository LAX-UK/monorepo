# DPA Tracker

Operating entity: **London Art Exchange (UK)**.

| Processor | Purpose | DPA status | Owner | Data region | Sub-processors reviewed | Renewal / review |
|-----------|---------|------------|-------|-------------|-------------------------|------------------|
| **Stripe** | Payments, Connect, Identity | _Legal: signed / in portal — confirm URL in contract file_ | CFO | US/EU per Stripe account | [Stripe list](https://stripe.com/service-providers) | Annual |
| **Postmark** (ActiveCampaign) | Transactional + broadcast email | _ActiveCampaign DPA accepted in dashboard_ | CTO | US | Postmark subprocessors doc | Annual |
| **Xero** | Invoicing / accounting | _Xero subscriber terms + DPA in product_ | CFO | AU/US per tenant | Xero trust page | Annual |
| **DigitalOcean** | App Platform, Postgres, Redis, Spaces | _DO online DPA accepted in account_ | CTO | EU (London `lon1`) | DO subprocessors | Annual |
| **Cloudflare** | DNS, TLS, WAF, rate limits | _Enterprise/Business terms — confirm tier_ | CTO | EU/US | Cloudflare subprocessors | Annual |

## Cookie / consent vendors

- **None deployed** in `apps/web` for third-party marketing/analytics scripts as of PPR-9 audit (session cookies only for auth). If Cookiebot/Iubenda is introduced later, add a row here and update the privacy notice.

## Procedure

1. Store PDFs / acceptance screenshots in the company **contracts** drive (not this repo).
2. Update the **DPA status** column when signatures complete.
3. On processor subprocessors material change: open ticket to **Compliance lead**.
