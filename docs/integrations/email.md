# Email Integration

## Ownership

`apps/*` owns transactional and notification email: auth verification/reset, password-changed, invites, bid/outbid, won/ended-lot, receipts, and invoices. Newsletter campaigns and subscriber state stay in Zoho Campaigns. `POST /newsletter/subscribe` only writes an audit log and pushes the address to Zoho.

## Provider Setup

- Transactional provider: Postmark.
- Sender domain: `mail.lax.bid`.
- Required DNS: SPF include for Postmark, Postmark DKIM records, and DMARC starting at `p=none` while monitoring alignment.
- Zoho Campaigns sends its own newsletter confirmation/campaign mail from Zoho-managed configuration; do not add Brevo vars or Brevo DKIM selectors.

## Runtime Vars

Set `EMAIL_PROVIDER=console` locally and `EMAIL_PROVIDER=postmark` in staging/prod after DNS verifies. Required production vars are `EMAIL_FROM`, `EMAIL_REPLY_TO`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_TRANSACTIONAL_STREAM`, `POSTMARK_BROADCAST_STREAM`, `POSTMARK_WEBHOOK_BASIC_AUTH`, `EMAIL_UNSUBSCRIBE_SECRET`, and `REQUIRE_EMAIL_VERIFICATION=true`.

Newsletter push uses `ZOHO_CAMPAIGNS_API_KEY` and `ZOHO_CAMPAIGNS_LIST_KEY`.

## Delivery Semantics

`IEmailService.enqueue()` writes `email_outbox` and enqueues BullMQ with `jobId=outboxId`. Calls inside a caller-managed DB transaction can share that transaction; Better Auth hook sends happen after Better Auth commits and are therefore at-least-once. The worker retry policy and `outbox-drain` repeatable job cover transient BullMQ enqueue failures.

Auth-category sends bypass suppression but set `flagged_address=true` when the address is suppressed. Transactional sends do not bypass suppression.

## Unsubscribe

Opt-outable notifications (`outbid`, `lot_won`, `lot_ended_seller`) use HMAC tokens scoped to `(userId, notificationType)` and flip `notification_preference.*Email`. Global unsubscribe tokens write `email_suppression(reason='unsubscribe')`. Auth and payment templates omit List-Unsubscribe headers.

## Webhooks

Postmark posts to `/webhooks/postmark` using Basic Auth. Delivery events are stored in `email_event`; hard bounces and complaints also upsert `email_suppression` and set `user.email_status` to `bounced` or `complained`.

## Swap Triggers

Investigate replacing Postmark if auth delivery p95 exceeds 30s for a week, hard bounce rate for legitimate mail exceeds 0.5%, production support is unanswered for more than 24h, or Postmaster Tools drops `mail.lax.bid` reputation below High.

## Rollout

1. Development: run with `EMAIL_PROVIDER=console` and `REQUIRE_EMAIL_VERIFICATION=false`.
2. Staging: verify Postmark DNS for `mail.lax.bid`, set `EMAIL_PROVIDER=postmark`, and send auth/reset/invite test messages.
3. Production: run the `0021_email_integration_schema` migration, including the existing-user `email_verified=true` backfill, before setting `REQUIRE_EMAIL_VERIFICATION=true`.
4. Add `mail.lax.bid` to Google Postmaster Tools and monitor reputation, bounce rate, and spam complaints before high-volume auctions.
5. Keep Zoho Campaigns list credentials isolated to the one-way newsletter push worker.

See `docs/runbooks/email-provider-incident.md` for the verification kill-switch procedure.
