Verdict: FIX FIRST

# Security review: PR #1472, enquiry replies by email, part A (Postmark inbound, flag off)

Reviewed head: `dff73bbc` on `enquiry-inbound-replies`, against `origin/main` at `67443083`.

One blocking item: CI's `test` job is red because of this PR (finding 1). The fix is two lines in tests. The security design is sound: nothing found that allows unauthenticated writes, attaching mail to another thread, or reading data. Findings 2 to 4 must be done before the flag is turned on in production, but they do not block merging with the flag off.

## Findings

1. **BLOCKING: two earlier migration rollback tests fail once 0397 is applied.**
   `packages/db/src/migration-0391-consignment-agreement-versions.integration.test.ts:228` and `packages/db/src/migration-0393-collection-storage-terms.integration.test.ts:20` roll back 0394 and older, but 0397 stays applied. The migration runner then refuses with "Migration history is missing … before applied timestamp 1812542400000". This is the failing CI `test` job (`@auction/db#test`), and it reproduces locally on Postgres 16. Fix: put `"0397_rollback.sql"` first in both lists, the same change #1460 made for 0393. Checked locally: with that change both files pass (18/18). If the migration is renumbered behind #1455 and #1461, those lists need the new names too.

2. **Before enabling: there is no quarantine purge job, but the owner doc says there is.**
   `docs/integrations/postmark-inbound.md:10` says quarantined mail "is purged after 30 days". The table has `purge_at` and `worker_app` gets `SELECT, DELETE` (`packages/db/src/migrate-roles.ts:847`), but no job deletes rows. The PR body lists the purge job as out of scope. Quarantined rows hold the raw sender address, subject and body, so with the flag on they would be kept forever. Either change the doc to say purging comes later, or land the job before enabling.

3. **Before enabling: erasure by account leaves that sender's quarantined mail.**
   `packages/persistence/src/lib/anonymise-enquiries.ts:114` deletes quarantine rows only when the erasure target is an email address (matched on `from_address`). When the target is a set of account ids, rows whose `suspected_enquiry_id` is one of the erased enquiries stay. Suggest also deleting rows where `suspected_enquiry_id` is in `ids`, and adding a test.

4. **Before enabling (hardening): sender check rests on From and SPF fail/softfail only.**
   `apps/api/src/services/marketing-enquiry/enquiry-inbound-reply.service.ts:113` and `:178`. To attach to a thread a mail needs a valid HMAC reply address, or a quoted staff message id, *and* From equal to the enquirer. That is a strong combination. Results other than fail (none, neutral, missing) are accepted, and DKIM/DMARC results are not checked. That is acceptable because quarantine is the fallback and nothing attached is acted on automatically. Worth considering before part B lets staff act on attached replies: quarantine when SPF is not pass and there is no aligned DKIM pass, or record the authentication result on the row so staff can see it.

5. Non-blocking: memory limit when there is no Content-Length.
   `apps/api/src/routes/webhooks/postmark-inbound.ts:44` reads the whole body with `c.req.text()` before the 40 MB length check when there is no `Content-Length`. This only happens after authentication and behind the existing `/webhooks/postmark/*` rate limiter, so the risk is low. A streaming cap or Hono `bodyLimit` would close it.

6. Non-blocking: two mutations survive because another layer covers the same behaviour.
   - Removing the `ENQUIRY_INBOUND_REPLIES_ENABLED` check (`postmark-inbound.ts:31`) passes all route tests, because the container also gives a null service when the flag is off. Behaviour stays safe. A route test where the flag is off but a service is present would pin the explicit check.
   - Removing only the replay pre-check (`enquiry-inbound-reply.service.ts:130`) passes the service tests, because the unique index and `ON CONFLICT DO NOTHING` guard catch it. That is the real idempotency guarantee, and mutating it does fail tests (see below).

7. Non-blocking: `api_app` gets `ALL PRIVILEGES` on `enquiry_inbound_quarantine` through the repo's default branch (`migrate-roles.ts:1615`).
   This follows the existing convention. The API needs INSERT, SELECT, DELETE (for erasure) and later UPDATE (for review). TRUNCATE, REFERENCES and TRIGGER are not needed. Tightening this can wait for the review-UI PR. `worker_app` grants are minimal: `SELECT, DELETE` on quarantine, plus `SELECT` and column-level `UPDATE` (subject, body, attachments) on `marketing_enquiry_message`. Checked against a live database after `db:roles`.

## Checks against the brief

- **Authentication:** the route refuses everything without its own Basic Auth (`POSTMARK_INBOUND_WEBHOOK_BASIC_AUTH`). There is no open mode: 404 while the flag is off, 503 with no secret. It is mounted separately from `/webhooks/postmark` and does not accept the delivery webhook's credentials (tested). Comparison uses `sharedSecretMatches` (length check, then `timingSafeEqual`). No credential or header is logged, and logger redaction is in place.
- **Reply tokens:** thread id plus HMAC-SHA256 proof truncated to 96 bits, with a key derived from a server secret of at least 32 characters. Checked with `timingSafeEqual`. A forged or malformed tag is quarantined as `bad_token` and never matched. A token names one thread only, and the route answers only an outcome code, so a token cannot be used to read data.
- **Spoofed From:** a mail is attached only if From equals the stored enquirer address *and* the thread is named by a valid token or a quoted staff message id. Mismatches go to quarantine. Inbound rows are always `direction = 'inbound'` with no user id, so they cannot appear as staff messages.
- **Idempotency:** unique partial index on `provider_message_id`, plus a unique index on quarantine, plus `ON CONFLICT DO NOTHING`, all inside one transaction with the event. The staff alert is sent only after a stored insert, with an idempotency key. Concurrent duplicates give one row, one event and one alert (integration test against real Postgres).
- **Size and HTML:** body capped at 20,000 characters and subject at 300 (also enforced by CHECK constraints). At most 20 attachments, metadata only, and base64 content is dropped by the parser. HTML is stripped, entities are decoded and stripped again, and control, bidi and zero-width characters are removed. No staff screen renders these rows yet (no readers in `apps/web`). Part B must still render them as escaped text, never as HTML.
- **PII in logs and events:** the route log has only the outcome, the reason code and the enquiry id. Events carry ids, the match method and a file count, and the PII allowlists were updated. The sender address is stored as a hash on thread rows.
- **Quarantine:** no code path moves a quarantined row onto a thread. The only writes are insert and the erasure delete.
- **Flag off:** no Reply-To change (`replyAddressFor` is undefined, so no `replyTo` var is sent). The worker only uses `replyTo` when it is a single valid address. The route returns 404.
- **Migration:** `0397_rollback.sql` was applied against Postgres 16 (table, columns and ledger row removed) and the migration then re-applied cleanly. The journal entry (`idx` 389, after 0394's 386) leaves room for #1455 (0395) and #1461 (0396). The rollback deletes the ledger row by `created_at`, which stays correct if the file is only renamed.
- **Owner docs:** `docs/integrations/postmark-inbound.md` and `docs/integrations/email.md` contain placeholder names only (`<INBOUND_USER>`, `<INBOUND_DOMAIN>` and so on), no values.
- **Attribution:** the commit message, the commit author and the PR text contain no Co-Authored-By, Claude-Session or generated-by lines.

## What was run

- Setup: `pnpm install --frozen-lockfile`, package builds, throwaway Postgres 16 on port 55432, `db:migrate`, `db:roles` (grants checked in `information_schema`), and the rollback followed by re-migration.
- Tests (`--maxWorkers=2`): api webhooks, marketing-enquiry and env tests, 194 passed. Worker Postmark sender, 11 passed. Persistence inbound repository integration and anonymisation, 53 passed (real database, none skipped). db migration 0397 contract, 4 passed. db 0391/0393 rollback tests: **2 failed** (finding 1).
- Mutation checks (each one was reverted afterwards):
  - Caught: auth always true, auth header check removed, auth comparing the user part only, HMAC proof check skipped, sender check removed, SPF check removed, duplicate guard removed, `ON CONFLICT DO NOTHING` removed.
  - Survived: the flag check and the replay pre-check alone (finding 6).
- Typecheck: db, persistence, types, email, api, worker and web pass (web after an api build). `biome check .` is clean. `lint:layers`, `lint:deps` and `lint:admin-capability-drift` pass.
- CI (REST check-runs on `dff73bbc`, GraphQL blocked): 34 success, 1 skipped, 1 failure (`test`, finding 1), and 3 still running at the time of review (`build`, `browser-gates`, `shop-v1-phase-smoke (admin-routes)`).
