Verdict: FIX FIRST

# Security recheck: PR #1472, enquiry replies by email, part A (Postmark inbound, flag off)

Rechecked head: `55efbcef` on `enquiry-inbound-replies`, against `origin/main` at `2504b5e2`. The PR still has migration `0397`. Main now has `0395` (#1455), and #1461 (`0396`, journal idx 388) is in the merge queue.

The fixes for the first review are correct, and the security design is unchanged and still sound. One new blocking item: since the fixer's merge, main has gained a helper with the same file name, so the PR now conflicts with main. GitHub reports it as not mergeable, and no CI has run on the fixed head.

## Findings

1. **BLOCKING: merge conflict with main, and no CI on the fixed head.**
   #1455 (now on main) added its own `packages/db/src/testing/later-rollbacks.ts`, which exports `laterRollbackSql(afterNumber: number)` and strips each rollback's BEGIN/COMMIT. It also updated the 0391/0393 rollback tests to use that helper. The PR adds a file at the same path with a different signature, `laterRollbackSql(tag: string)` (`packages/db/src/testing/later-rollbacks.ts:21`). Merging main conflicts in four files: that helper (add/add), `migration-0391-consignment-agreement-versions.integration.test.ts`, `migration-0393-collection-storage-terms.integration.test.ts` and `drizzle/meta/_journal.json`. Because of the conflict, there are no check runs or workflow runs on `55efbcef` (or on `07471e79`).
   Resolution, checked locally on a throwaway merge (not pushed): take main's version of the helper and of both 0391/0393 tests (dropping the PR's helper), and keep 0397's journal entry after 0395's. With that merge, the full `packages/db` suite passed against a fresh Postgres 16 database after `db:migrate` and `db:roles`: 216 files and 1163 tests passed, 87 skipped, no failures. This includes the 0391, 0393, 0395, 0397, 0257 and 0261 migration tests. Main's helper reads the order from the journal, so 0396 and 0397 are picked up with no further edit. Then push a normal merge and let CI run.

2. Non-blocking: the new erasure test only counts delete calls.
   `packages/persistence/src/lib/anonymise-enquiries.test.ts:121` asserts `del` was called twice, but it does not check that the second delete targets `enquiry_inbound_quarantine` by `suspected_enquiry_id`. The fix itself (`packages/persistence/src/lib/anonymise-enquiries.ts:117`) is correct. A test that checks the table and the condition, or an integration test against real Postgres, would pin it.

3. Before enabling (carried over, now documented): the quarantine purge job still does not exist.
   `docs/integrations/postmark-inbound.md:10` now says this correctly: the job is not built and must land before the flag is turned on in production. This does not block merging with the flag off.

4. Before enabling (carried over, hardening): the sender check uses From and SPF fail/softfail only (`apps/api/src/services/marketing-enquiry/enquiry-inbound-reply.service.ts:113`, `:178`). This is unchanged. Before part B lets staff act on attached replies, consider requiring SPF pass or an aligned DKIM pass, or record the authentication result on the row.

5. Non-blocking (carried over): `apps/api/src/routes/webhooks/postmark-inbound.ts:44` reads the whole body before the size check when there is no Content-Length. This happens only after authentication and behind the rate limiter. A streaming cap or `bodyLimit` would close it.

6. Non-blocking (carried over): no route test pins the explicit flag check (`postmark-inbound.ts:31`). `api_app` keeps blanket grants on `enquiry_inbound_quarantine`, which can be tightened in the review-UI PR.

## First-review findings

- First-review 1 (blocking, rollback tests): **fixed on the PR head**. The 0391/0393 tests now take later rollbacks from the journal instead of a hard-coded list. On `55efbcef` the full `packages/db` suite is green against Postgres 16 at port 55432 (cluster under `/var/tmp`, after `db:migrate` and `db:roles`): 215 files and 1159 tests passed, 87 skipped, no failures. The 0391 and 0393 rollback tests ran and were not skipped. The conflict in finding 1 replaces this helper with main's equivalent.
- First-review 2 (purge doc): fixed. The doc now matches the code.
- First-review 3 (erasure by account): fixed. Rows whose `suspected_enquiry_id` is an erased enquiry are now deleted for both target kinds (see finding 2 for the test).
- First-review 4 to 7: hardening and non-blocking items, unchanged, as expected.

## Migration

- Number: `0397` is the next free number after main's `0395` and #1461's `0396`. Journal: `idx` 389 (`_journal.json:2708`), `when` 1812542400000. Main's 0395 is idx 387 at 1812369600000, and #1461's 0396 is idx 388 at 1812456000000, so both idx and when are strictly increasing.
- `0397_rollback.sql` deletes the ledger row `WHERE "created_at" = 1812542400000`, which matches the journal `when`. BEGIN/COMMIT are on lines of their own, so main's helper strips them correctly. On the trial merge, rollback and re-apply ran through the 0391/0393 tests.

## Security points (re-verified on 55efbcef)

- Authentication: a separate inbound route with its own Basic Auth. 404 while the flag is off, 503 with no secret, 401 otherwise. `sharedSecretMatches` compares in constant time. There is no open mode, and the delivery-webhook credentials are refused (tested).
- Reply tokens: thread id plus HMAC-SHA256 proof (96 bits) under a key derived from the server secret, compared with `timingSafeEqual`. A bad tag is quarantined as `bad_token`.
- Spoofed senders: a mail is attached only with a valid token or a quoted staff message id, and From equal to the enquirer. Everything else goes to quarantine with at most a `suspected_enquiry_id`, never onto the thread.
- Idempotency: replay pre-check, unique indexes on `provider_message_id` (message and quarantine), `ON CONFLICT DO NOTHING`, and the event in the same transaction. The alert is sent only after a stored insert. The concurrent-replay integration test passes.
- Sanitising and limits: plain text only, body capped at 20,000 and subject at 300 characters (with CHECK constraints), at most 20 attachments stored as metadata only, and control and bidi characters removed.
- Logs and events: outcome, reason code and enquiry id only. Events carry ids, the match method and a count. PII allowlists are updated.
- Quarantine: insert and erasure delete only, with no path onto a thread.
- Flag off: route 404 and no per-thread Reply-To.
- Owner docs: placeholders only (`<INBOUND_USER>`, `<INBOUND_DOMAIN>` and so on), no values.
- Attribution: none of the three PR commit messages, nor the PR title or body, contain Co-Authored-By, Claude-Session or generated-by lines. All commits are authored by the repo owner identity.

## What was run

- Setup: `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`, Postgres 16 from `/usr/lib/postgresql/16/bin` (initdb under `/var/tmp`, port 55432), `db:migrate`, `db:roles`.
- Tests (`--maxWorkers=2`): full `packages/db` suite on the PR head and on the trial merge (results above). API webhooks, marketing-enquiry and env tests: 194 passed. Worker Postmark sender: 11 passed. Persistence inbound repository integration (real database) plus anonymisation: 36 passed.
- Typecheck: db, persistence, types, email, api, worker and web pass. `biome check .` is clean. `lint:layers`, `lint:deps`, `lint:admin-capability-drift` and the route DIP coverage check pass.
- CI: the REST check-runs and workflow runs for `55efbcef` are empty (0). PR `mergeable: false`, `mergeable_state: dirty` (GraphQL is blocked).
