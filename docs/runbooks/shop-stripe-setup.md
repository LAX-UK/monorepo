# Shop Stripe setup (test and production)

## Account model

**Target end state:** a [Stripe Organization](https://stripe.com/docs/connect/account-management) with
separate **Bid** and **Shop** accounts so keys, webhooks, and reporting stay product-owned.

**Test phase (current):** Shop and lax.art run on the dedicated **London Art Test** sandbox
(`acct_1UPkKJ3K388lobXL`) with `STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art`. Bid stays on the
**London Auction Xchange LTD** sandbox; its `STRIPE_*` secrets and webhooks are untouched. London
Art Test stands in for LAX Art account 2 until the business creates it under the organization.

| Item | Value |
| --- | --- |
| Checkout webhook | `https://test-shop.lax.bid/webhooks/stripe` |
| Connect webhook | `https://test-shop.lax.bid/webhooks/stripe/connect` (`account.updated`) |
| GitHub `test` secrets | `STRIPE_SHOP_SECRET_KEY`, `STRIPE_SHOP_PUBLISHABLE_KEY`, `STRIPE_SHOP_WEBHOOK_SECRET`, `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET` |
| GitHub `test` variable | `STRIPE_SHOP_CONNECT_PLATFORM_KEY=lax_art` |

Connect rows created while Shop shared Bid's sandbox stay keyed `bid_sandbox` and are never reused;
payees onboard again on London Art Test. Moving to the real LAX Art account repeats the same
rotation — new keys, both webhook secrets, fresh payee onboarding — per
[lax-art-production-launch.md](./lax-art-production-launch.md).

Shop checkout metadata must remain Shop-scoped (`metadata.app = "shop"`). Shop ignores money events
whose PaymentIntent it does not own, so a shared account never mutates Bid state.

## Test environment

### 1. Stripe Dashboard (test mode)

1. Create a **restricted key** with **Checkout Sessions: Write** and **Refunds: Write** (Phase 2+). Add **Disputes: Read** for chargeback handling, and Connect account write access for payee onboarding.
2. Create a webhook endpoint:
   - URL: `https://test-shop.lax.bid/webhooks/stripe`
   - Events:
     - `checkout.session.completed`
     - `checkout.session.async_payment_succeeded`
     - `checkout.session.async_payment_failed`
     - `checkout.session.expired`
     - `charge.refunded`
     - `refund.updated`
     - `charge.dispute.created`
     - `charge.dispute.updated`
     - `charge.dispute.closed`
3. **Shared Stripe account:** Shop ignores money events unless the PaymentIntent is owned by Shop (`metadata.app = "shop"` on the PI, or a matching `shop_order.stripe_payment_intent_id`). Bid-shaped events must return **200** without mutation.
3. Copy `sk_test_…` and `whsec_…`. Do not change Bid’s existing webhook endpoints.

### 2. GitHub environment secrets (`test`)

Set with `gh secret set <NAME> --env test --repo LAX-UK/monorepo` (pipe the value on stdin; never pass it as an argument):

- `STRIPE_SHOP_SECRET_KEY` — restricted Shop key
- `STRIPE_SHOP_PUBLISHABLE_KEY` — same account's `pk_test_…` (Connect embedded onboarding)
- `STRIPE_SHOP_WEBHOOK_SECRET` — checkout endpoint signing secret
- `STRIPE_SHOP_CONNECT_WEBHOOK_SECRET` — Connect endpoint signing secret

and the `test` variable `STRIPE_SHOP_CONNECT_PLATFORM_KEY` (`lax_art` or `bid_sandbox`). Terraform apply workflows pass them as `TF_VAR_stripe_shop_*` into `auction-infra` for the `shop-api` component; an empty `STRIPE_SHOP_PUBLISHABLE_KEY` falls back to Bid's `STRIPE_PUBLISHABLE_KEY`.

### 3. Infra apply order

Apply `auction-infra` **after** GitHub secrets exist. `shop-api` runs with `NODE_ENV=production` and exits at boot if Stripe secrets are missing.

The test app exposes `POST /webhooks/stripe` on the shop host via ingress (`/webhooks` → `shop-api`, `preserve_path_prefix = true`). Catalogue and commerce traffic remain on internal `http://shop-api:3011`.

### 4. Verification

```bash
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://test-shop.lax.bid/webhooks/stripe
```

Expect **400** (`Webhook not configured` or `Invalid signature`), never **404**.

Use Stripe CLI or Dashboard “Send test webhook” for `checkout.session.completed`, then complete a test-card purchase and confirm the order moves to `paid` with editions `sold`.

## Production before the storefront launch

- In production shop-api refuses to start without `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` unless `SHOP_REQUIRE_STRIPE=false`. Terraform sets it from `storefronts_public`, so while Shop and lax.art are private shop-api starts without the keys, logs that checkout, refunds and Connect payouts are disabled, and answers checkout with 503. Payouts, Connect transfers and originals call Stripe directly, so with any of `SHOP_PAYOUTS_ENABLED`, `SHOP_CONNECT_TRANSFERS_ENABLED` or `SHOP_ORIGINALS_ENABLED` on, shop-api still refuses to start without the keys, and the prod apply workflow refuses to run.

## Local development

- `SHOP_FAKE_CHECKOUT_ENABLED=true` with no Stripe keys enables the fake checkout path (local only).
- For real webhooks locally: `stripe listen --forward-to localhost:3011/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET` to the CLI signing secret.

## Production

Mirror the same pattern on `shop.lax.art` when Shop ships to production: prod restricted live key, prod webhook endpoint, prod GitHub secrets, and matching Terraform variables on `terraform/ephemeral/prod` (not yet wired in this slice).
