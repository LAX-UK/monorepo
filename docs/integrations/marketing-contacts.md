# Marketing Contacts (Brevo) — interim Plan B

> **Implementation status:** Live in repo behind `MARKETING_CONTACT_SYNC_PROVIDER` (default `none`).
> DNS for `news.lax.bid` is in Terraform; Brevo domain authentication is an ops step in the Brevo UI.

While Zoho is not ready, registered users are synced into **Brevo** (EU/GDPR-native ESP) so the
marketing team can run lifecycle campaigns (KYC/required-task reminders before an auction,
invitations, etc.) entirely from the Brevo dashboard. This is a one-way contact sync — campaign
authoring and sending happen in Brevo, not in our apps. Transactional/auth email stays on Postmark
and is untouched.

## Ownership & boundaries

- `apps/*` owns transactional + notification email (Postmark, `mail.lax.bid`).
- Brevo owns the marketing audience, segments, campaigns, and the visible From address.
- The platform only **pushes contacts** and **ingests opt-outs/bounces**; it never sends marketing
  mail via Postmark's broadcast stream.
- The existing "do not add Brevo vars/DKIM to the transactional Postmark setup" rule in
  `email.md` still holds: marketing Brevo runs in its own workspace on a separate subdomain.

## Legal basis

Lifecycle reminders/invitations to registered users are sent under **legitimate interest /
service-related** grounds (not newsletter marketing consent). Opt-outs are always honored:
unsubscribe/bounce/blocklist events flow back into `email_suppression`, which the sync job
respects. If the business later requires explicit opt-in, add a `marketing_opt_in`
column + signup checkbox and extend the eligibility filter in
`apps/worker/src/lib/marketing-contact-sync/eligibility.ts`.

## Architecture

```
domain_events --> marketing_contacts projector (worker) --> marketing-sync queue
  --> marketing-contact-sync job --> IMarketingContactSync (Brevo adapter) --> Brevo (EU)
Brevo webhook --> POST /webhooks/brevo (apps/api) --> email_suppression (+ user.email_status)
```

- Projector cursor: `marketing_contacts` (independent of the `zoho` cursor). Triggers on:

| Domain event | Producer | Enqueue reason |
|--------------|----------|----------------|
| `user.registered` | `apps/auth`, `apps/api` | `registered` |
| `user.email_verified` | `apps/auth` | `email_verified` |
| `user.deletion_requested` | `apps/api` (`POST /users/me/delete`) | `deletion_requested` |
| `kyc.verified` | `apps/api` (aggregate id = user id) | `kyc_verified` |

- `user.email_verified` is emitted from auth when a user completes email verification
  (`packages/auth` `afterEmailVerification` → `apps/auth` `publishUserEmailVerified`).
- On `user.deletion_requested`, the sync job **archives** the contact in Brevo (DELETE contact by
  email) even though `deletion_requested_at` is set — do not wait for purge.
- Job loads the **live** `user` row, applies the shared eligibility filter (see below), archives
  contacts pending deletion (GDPR), and writes one `marketing_contact_sync_log` audit row per
  attempt.
- Retry semantics: only `429`/`5xx`/network errors are retried by BullMQ; other `4xx` are terminal.
- Failed marketing-sync jobs are reported to Sentry like other worker queues.

## Eligibility (live sync)

Defined in `apps/worker/src/lib/marketing-contact-sync/eligibility.ts`:

| Rule | Effect |
|------|--------|
| `emailVerified` (any) | Synced to Brevo as boolean attribute `EMAIL_VERIFIED` (segment in Brevo, not a platform skip) |
| `emailStatus = ok` | Bounced/complained users are skipped |
| `role` not in `staff` | Internal accounts excluded |
| `suspendedAt` null | Suspended users skipped |
| `deletionRequestedAt` null (for upsert) | Pending erasure → **archive** in Brevo instead |
| Not in `email_suppression` | Honors Brevo webhook opt-outs |

**Known gaps:**

- **Email change:** in-app email updates do not re-key the Brevo contact; fix manually in Brevo or
  add a `user.email_changed` consumer later.
- **Admin suspend:** no domain event today; a suspended user already in Brevo stays until the next
  qualifying event (or ops remove them). New suspensions are skipped on the next sync attempt.

## Code map (SOLID layout)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Port | `apps/worker/src/lib/marketing-contact-sync/types.ts` | `IMarketingContactSync`, `MarketingContact`, `SyncResult` |
| Adapter | `apps/worker/src/lib/marketing-contact-sync/brevo.ts` | Brevo HTTP (`POST/DELETE /v3/contacts`) |
| Factory | `apps/worker/src/lib/marketing-contact-sync/index.ts` | `createMarketingContactSync(env)` composition root |
| Rules | `apps/worker/src/lib/marketing-contact-sync/eligibility.ts` | Shared skip rules (+ unit tests) |
| Job | `apps/worker/src/jobs/marketing-contact-sync.ts` | Load live user, audit log, retry policy |
| Projector | `apps/worker/src/projectors/runner.ts` | `marketing_contacts` cursor → BullMQ |
| Webhook | `apps/api/src/routes/webhooks/brevo.ts` | Opt-out / bounce → `email_suppression` |
| Schema | `packages/db/src/schema/marketing-contact-sync.ts` | `marketing_contact_sync_log` audit table |
| Migration | `packages/db/drizzle/0096_marketing_contact_sync_log.sql` | Table + indexes |

Adding another ESP (e.g. Zoho lists): implement `IMarketingContactSync`, extend the factory switch,
no changes to the job or projector.

## Brevo contact attributes (one-time, Brevo UI)

Before the first sync/import, create these **contact attributes** in Brevo (Settings → Contacts →
Contact attributes). Names must match what the adapter sends:

- `KYC_STATUS`, `SIGNUP_SOURCE`, `COUNTRY` (text) — custom attributes you must create
- `EMAIL_VERIFIED` (boolean) — mirrors `user.email_verified`; create before deploy
- `FIRSTNAME`, `LASTNAME` — Brevo defaults; the adapter sets them when present on the user row

Without the custom attributes, Brevo may reject or ignore attribute updates on upsert.

## Brevo segments (campaign targeting)

Use the same list (`BREVO_LIST_ID`) and build segments in the Brevo UI — the platform does not send
campaigns, only keeps attributes current:

| Campaign | Example segment |
|----------|-----------------|
| Verify email before auction | `EMAIL_VERIFIED` = No |
| KYC / required-task reminder | `KYC_STATUS` in `unverified`, `pending` and `EMAIL_VERIFIED` = Yes |
| Post-verify lifecycle | `EMAIL_VERIFIED` = Yes |

Avoid broad promotional sends to contacts with `EMAIL_VERIFIED` = No; reserve that segment for
account verify reminders only.

## Worker env

- `MARKETING_CONTACT_SYNC_PROVIDER` = `none` (default) | `brevo`.
- `BREVO_API_KEY` — Brevo API v3 key.
- `BREVO_LIST_ID` — target Brevo list (integer).

When `MARKETING_CONTACT_SYNC_PROVIDER=brevo`, the worker fails fast at boot if `BREVO_API_KEY` or
`BREVO_LIST_ID` is missing.

### Terraform / GitHub (deployed stacks)

Ephemeral Terraform sets the provider statically per stack (not from GitHub variables):

| Stack | Worker `MARKETING_CONTACT_SYNC_PROVIDER` | Worker `BREVO_*` | API `BREVO_WEBHOOK_SECRET` |
|-------|------------------------------------------|------------------|----------------------------|
| **prod** | `brevo` (hardcoded) | `BREVO_API_KEY` + `BREVO_LIST_ID` from GitHub | `BREVO_WEBHOOK_SECRET` secret |
| **test** | `none` (hardcoded) | not set | placeholder (sync disabled) |

GitHub **Environment `prod`**:

- **Secrets:** `BREVO_API_KEY`, `BREVO_WEBHOOK_SECRET`
- **Variable:** `BREVO_LIST_ID` (numeric list id)

Wired through `terraform-apply-prod.yml` as `TF_VAR_brevo_*`. Test apply does not pass Brevo keys;
the worker never calls Brevo when the provider is `none`.

## API env

- `BREVO_WEBHOOK_SECRET` — shared secret for the opt-out/bounce webhook. **Required in production**
  (API env validation fails boot without it). In non-production an unset secret is accepted with a
  warning (mirrors Postmark).

## Webhook

Configure a Brevo webhook (marketing + transactional events) to:

```
POST https://api.lax.bid/webhooks/brevo?secret=$BREVO_WEBHOOK_SECRET
```

You may also send the secret via header `x-brevo-secret`.

Mapped events:

- `unsubscribe` / `unsubscribed` / `list_unsubscribe` / `blocked` / `blocklist` / `blacklist` →
  `email_suppression(reason='unsubscribe')`.
- `spam` / `complaint` → `email_suppression(reason='complaint')` + `user.email_status='complained'`.
- `hard_bounce` / `hardbounce` → `email_suppression(reason='hard_bounce')` +
  `user.email_status='bounced'`.
- delivery/open/click and unknown events are acknowledged and ignored.

## DNS & sender domain (required for sending, not for contact sync)

**Contact sync and the webhook do not need extra DNS** beyond your API being reachable on the
public internet. DNS work is required when marketing **sends** mail from Brevo.

Use a **dedicated subdomain** isolated from Postmark transactional mail:

| Purpose | Subdomain | Provider |
|---------|-----------|----------|
| Transactional (auth, KYC, bids) | `mail.lax.bid` | Postmark |
| Marketing (campaigns, lifecycle) | `news.lax.bid` (example) | Brevo |

Do **not** add Brevo DKIM records on `mail.lax.bid` — keep reputations separate.

### One-time setup (DNS via Terraform)

DNS for `news.lax.bid` is declared in
[`infra/terraform/persistent/prod/main.tf`](../../infra/terraform/persistent/prod/main.tf)
(same pattern as Postmark on `mail.lax.bid`). Terraform is the source of truth for the `lax.bid`
zone — see `docs/integrations/cloudflare.md`. Do not add duplicate records manually in Cloudflare.

| Record | Type | Cloudflare name | Purpose |
|--------|------|-----------------|---------|
| Domain verify | TXT | `news` | `brevo-code:…` from Brevo UI |
| DKIM 1 | CNAME | `brevo1._domainkey.news` | `b1.news-lax-bid.dkim.brevo.com` |
| DKIM 2 | CNAME | `brevo2._domainkey.news` | `b2.news-lax-bid.dkim.brevo.com` |
| DMARC | TXT | `_dmarc.news` | Brevo-suggested policy (`p=none` while monitoring) |

Apply from `infra/terraform/persistent/prod`:

```bash
terraform plan
terraform apply
```

If Brevo later shows an **SPF** TXT on `news`, add it to the same `locals.subdomains` block and
re-apply.

After DNS is live:

1. **Brevo** → Senders, Domains & Dedicated IPs → verify `news.lax.bid` (refresh until authenticated).
2. Create sender **`marketing@news.lax.bid`** and set it as the campaign default From.
3. Send a seed campaign; confirm **DKIM=pass** and **DMARC=pass** in message headers.

Return-Path / bounce handling for marketing is owned by Brevo on that subdomain; Postmark bounce
processing on `mail.lax.bid` is unchanged.

## Historical contacts

The live projector only syncs users when a qualifying **domain event** occurs after deploy (register,
verify, KYC, deletion). Users who already existed before enablement are **not** replayed automatically.
Load them via a separate ops process:

```bash
# Dry-run (lists eligible users missing user.registered)
DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-registered-events

# Apply (inserts idempotent user.registered events; worker syncs on next tick)
DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-registered-events -- --apply

# Include users already synced via email_verified/kyc but missing user.registered (broader)
DATABASE_URL=... pnpm --filter @auction/db db:backfill-user-registered-events -- --all-missing-events
```

Run against production as `DATABASE_URL_OWNER` during a maintenance window. The worker's
`marketing_contacts` projector enqueues Brevo sync jobs; legal-entity provisioning is idempotent.

## Rollout

1. Run migration `0096_marketing_contact_sync_log` and apply role grants.
2. Create Brevo contact attributes (including boolean `EMAIL_VERIFIED`) + target list.
3. `terraform apply` ephemeral prod; authenticate `news.lax.bid` in Brevo; seed-send and verify DKIM/DMARC.
4. Confirm worker has `MARKETING_CONTACT_SYNC_PROVIDER=brevo` (Terraform prod); monitor `marketing_contact_sync_log` and projector lag.
5. Configure Brevo webhook → prod API; confirm opt-outs land in `email_suppression`.
6. Backfill pre-existing users separately if needed (not part of the deployed apps).

## Monitoring & troubleshooting

**Projector lag** (events not reaching Brevo):

```sql
SELECT projector_name, last_processed_event_id, updated_at, last_error
FROM projector_state
WHERE projector_name = 'marketing_contacts';
```

**Recent sync outcomes:**

```sql
SELECT status, action, reason, count(*)
FROM marketing_contact_sync_log
WHERE created_at > now() - interval '24 hours'
GROUP BY 1, 2, 3
ORDER BY 4 DESC;
```

**Failed / rejected rows for one user:**

```sql
SELECT * FROM marketing_contact_sync_log
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
```

Common fixes:

| Symptom | Check |
|---------|--------|
| Contact never appears | `email_suppression`, worker `MARKETING_CONTACT_SYNC_PROVIDER=brevo`, audit log skip reason |
| Verify reminder not reaching unverified | Contact exists with `EMAIL_VERIFIED` = No; segment targets that attribute |
| Stale `KYC_STATUS` in Brevo | `kyc.verified` events flowing; re-sync or manual update in Brevo |
| Still mailed after opt-out | Brevo webhook URL + `BREVO_WEBHOOK_SECRET`; row in `email_suppression` |
| 4xx in audit log | Brevo attribute names, API key scopes, list id |

BullMQ job id: `marketing-contact-sync-{domainEventId}` (no `:` — BullMQ rejects colons in custom ids; dedupes projector retries).

## Switching back to Zoho

Set `MARKETING_CONTACT_SYNC_PROVIDER=none` (or add a `zoho` adapter behind `IMarketingContactSync`).
`email_suppression` opt-outs are provider-agnostic and carry forward, so no opt-out is lost.

## Related docs

- Transactional email: `docs/integrations/email.md`
- DNS / zone: `docs/integrations/cloudflare.md`
- Domain events catalog: `docs/architecture/04-domain-events.md`
- GDPR deletion: `docs/runbooks/deletion-request.md`, `docs/security/data-deletion.md`
