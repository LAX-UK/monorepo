# Runbook: Stripe Connect (UK) — go-live checklist

Use this before enabling seller payouts in production.

## 1. Stripe Dashboard

- [ ] **Connect** application settings: UK capabilities, branding, and redirect URLs include production `WEB_ORIGIN` paths (`/dashboard/seller/connect`, team flows if applicable).
- [ ] **Webhooks**: Connect endpoint(s) registered; signing secret matches `STRIPE_WEBHOOK_SECRET` (or env name used in API).
- [ ] **Restricted keys** or live secret key stored only in secrets manager / Terraform, not in repo.

## 2. Application environment

- [ ] `STRIPE_SECRET_KEY` is **live** key for production stack.
- [ ] `DISABLE_PAYOUT_SETTLEMENT` is **unset** or `false` when finance is ready to run settlement crons.
- [ ] `SENTRY_DSN_API` set if error reporting is required for Connect onboarding failures.

## 3. Smoke tests (staging with live-mode test accounts)

- [ ] Individual seller: `POST /stripe-connect/account` → onboarding link → return URL lands on `/dashboard/seller/connect`.
- [ ] Requirements currently due: verify `stripe_connect_disabled_reason` surfaces in API/UI when Stripe disables the account.
- [ ] Webhook `account.updated`: DB row updates charges/payouts flags and requirements JSON.

## 4. Operational

- [ ] Finance knows how to use **Legal entities → Stripe Connect requirements** admin queue.
- [ ] Support macro for “Connect incomplete” links sellers to `/dashboard/seller/connect` (individuals) or team onboarding for organisations.

## 5. Rollback

- Set `DISABLE_PAYOUT_SETTLEMENT=true` to stop bulk payout jobs without taking the site offline.
- Set `DISABLE_BIDDING=true` only if you must freeze auctions (wide blast radius).
