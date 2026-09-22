# Shop Stripe setup (test and production)

Shop shares the LAX Stripe platform account with Bid but uses a **separate restricted API key**, **separate webhook endpoint**, and **Shop-only checkout metadata** (`metadata.app = "shop"`).

## Test environment

### 1. Stripe Dashboard (test mode)

1. Create a **restricted key** with **Checkout Sessions: Write** only (no Connect, transfers, refunds, disputes, or payouts).
2. Create a webhook endpoint:
   - URL: `https://test-shop.lax.bid/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
3. Copy `sk_test_…` and `whsec_…`. Do not change Bid’s existing webhook endpoints.

### 2. GitHub environment secrets (`test`)

Add:

- `STRIPE_SHOP_SECRET_KEY` — restricted Shop Checkout key
- `STRIPE_SHOP_WEBHOOK_SECRET` — Shop endpoint signing secret

Terraform apply workflows pass these as `TF_VAR_stripe_shop_secret_key` and `TF_VAR_stripe_shop_webhook_secret` into `auction-infra` for the `shop-api` component.

### 3. Infra apply order

Apply `auction-infra` **after** GitHub secrets exist. `shop-api` runs with `NODE_ENV=production` and exits at boot if Stripe secrets are missing.

The test app exposes `POST /webhooks/stripe` on the shop host via ingress (`/webhooks` → `shop-api`, `preserve_path_prefix = true`). Catalogue and commerce traffic remain on internal `http://shop-api:3011`.

### 4. Verification

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://test-shop.lax.bid/webhooks/stripe
```

Expect **400** (`Webhook not configured` or `Invalid signature`), never **404**.

Use Stripe CLI or Dashboard “Send test webhook” for `checkout.session.completed`, then complete a test-card purchase and confirm the order moves to `paid` with editions `sold`.

## Local development

- `SHOP_FAKE_CHECKOUT_ENABLED=true` with no Stripe keys enables the fake checkout path (local only).
- For real webhooks locally: `stripe listen --forward-to localhost:3011/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the CLI signing secret.

## Production

Mirror the same pattern on `shop.lax.art` when Shop ships to production: prod restricted live key, prod webhook endpoint, prod GitHub secrets, and matching Terraform variables on `terraform/ephemeral/prod` (not yet wired in this slice).
