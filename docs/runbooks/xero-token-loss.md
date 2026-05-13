# Xero OAuth token loss / tenant disconnect

## Symptom

- Admin Xero page shows disconnected; invoice creation returns errors; webhooks stop authenticating.

## Diagnosis

1. **API logs** — Xero 401/403 on `createInvoices` or token refresh.
2. **DB** — `xero_connection` (or equivalent) row missing or `refresh_token` invalid.
3. **Xero developer portal** — app still approved? Redirect URI matches `XERO_REDIRECT_URI`?

## Resolution

1. Have a **finance admin** open **Admin → Integrations → Xero** and complete OAuth again (browser flow).
2. Ensure `XERO_POST_CONNECT_WEB_REDIRECT` sends the user back to the admin UI success page.
3. **Webhook key** — if rotated, update `XERO_WEBHOOK_KEY` in secrets + Terraform apply + redeploy API.
4. **Replay** missed invoice syncs via admin payment Xero sync routes if documented in finance procedures.

## Escalation

- Xero support for tenant-level lockouts.

## Related

- [Xero + Stripe payment setup](./xero-stripe-payment-setup.md)
