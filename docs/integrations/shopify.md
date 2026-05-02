# Shopify

Assumption for v1: non-Plus, Shopify-hosted storefront.

Configure a Shopify custom app with webhook subscriptions:

- `customers/create`
- `customers/update`
- `orders/create`
- `orders/paid`
- `orders/fulfilled`
- `customers/data_request`
- `customers/redact`
- `shop/redact`

Webhook URL:

```text
https://api.thealx.bid/webhooks/shopify
```

The API verifies `X-Shopify-Hmac-SHA256` using `SHOPIFY_WEBHOOK_SECRET`, stores the raw event in `webhook_event`, and the worker projects relevant events to `domain_events` / Zoho.

SSO note: Multipass is deferred unless Shopify Plus is confirmed. Until then, account linking is email-based and gated on verified email.
