Verdict: FIX FIRST

# Security recheck, round 3: PR #1479, enquiry replies by email, part B

Reviewed head: `1a8a2e97` on `enquiry-inbound-replies-part-b`. The fix commits are `bc25b29b..1a8a2e97`. The previous recheck (at `bc25b29b`) is the previous version of this file.

All three items from the previous recheck are fixed and verified locally, and the eight earlier fixes still hold. I found no new security defect in the code. The verdict is FIX FIRST for one reason only: the required `build` check failed on this head, so `ci-result` is red. The runner lost contact with GitHub partway through the build step. The same build passes locally, so this looks like an infrastructure failure, but the required checks have to be green before merge. The branch also has a merge conflict with `main` (finding 2). After the conflict is resolved, CI will run again on the new head.

## Findings

1. **BLOCKING: required CI is not green on `1a8a2e97`.** The CI workflow's `build` job (`pnpm turbo run build --affected`) failed after 50 minutes. The job's annotation says "The hosted runner lost communication with the server". No log was kept, and the step never reported a result. `ci-result` failed because of it. All the other check runs passed, including `worker-role-contract`, `identity boundary conformance`, `browser-gates`, `static-checks`, `test`, the api, web and shop-api vitest shards, and `docker-images`. `art-browser-gates` was skipped, as it was on the previous head.
   - On `bc25b29b` the same job passed in about 10 minutes. The only changes since then that the build sees are one copy string and some small changes to the service, repository and persistence code.
   - Running `pnpm turbo run build` locally for web, api and worker (with the CI's `NODE_OPTIONS=--max-old-space-size=6144` and the budget DSNs) passed all 37 tasks in about 9 minutes on a 4-core, 15 GB machine.
   - Fix: re-run the job, or let it run again on the head after the merge from finding 2. Then confirm that `build`, `Route JavaScript budgets` and `ci-result` pass. If the runner drops again, check whether the web build runs out of memory on the hosted runner.

2. Should fix before merge (not a security issue): the branch conflicts with `main`. GitHub reports the PR as `dirty`. The only conflict is in `apps/api/src/services/interfaces/admin-routes/admin-satellite-routes.ts`, where `main` added `collectionStorage: ICollectionStorageAdminService` next to this PR's changes. It is a type-only conflict. After resolving it, check that the merged route wiring still applies `requireEnquiryWork` and the capability checks to the held-email routes.

3. Non-blocking: a review reason can outlive its link to the person in two cases.
   - A discard event whose held row was already purged after 30 days. This one is documented.
   - An attach of one person's mail to a different person's enquiry, once the held row has been purged. Erasing the sender then neither matches the enquiry id nor finds the quarantine id (`packages/persistence/src/lib/anonymise-enquiries.ts:391`).
   The dialog hints now tell staff not to put the sender's name, address or phone number in the reason (`apps/web/src/lib/admin/enquiries/enquiry-email-copy.ts:128`, `:150`). That is a reasonable control for both cases.

4. Non-blocking: the catalogue does not mark these events as personal. `marketing_enquiry.inbound_attached` and `.inbound_discarded` are `piiClassification: "none"` (`packages/types/src/domain-event-catalog/registry.ts:1005`, `:1011`), yet erasure now rewrites them because the staff-typed reason can name the sender. `marketing_enquiry.erased` does the same, so this follows precedent. Consider marking the two events `contains_pii` so the catalogue matches how erasure treats them.

5. Non-blocking: one test depends on the order the test files run. `drizzle-enquiry-inbound-review.repository.integration.test.ts:81` ("lists pending mail newest first with keyset paging") failed once when the persistence `enquiry` and `anonymis` integration tests ran together with `--maxWorkers=2` on a shared database. Another file's held rows were inserted while this test was paging. It passes on its own, twice, and the full set passes 82/82 with `--maxWorkers=1`. Scoping its list to the rows it seeds (or to a time window) would stop it from failing intermittently in CI.

6. Unchanged, documented hardening: SPF still trusts the topmost `Received-SPF` header whose `receiver=` is the trusted receiver (`apps/api/src/services/marketing-enquiry/inbound-authentication.ts:72`). The runbook step to check this on a live test message before turning the flag on still covers it.

## Items from the previous recheck

1. **worker_app can scrub `review_reason` (was blocking): fixed.**
   - `packages/db/src/migrate-roles.ts:1137` adds `review_reason` to the `marketing_enquiry_message` entry, and to nothing else.
   - After `db:migrate`, the worker probe seed and `db:roles` on Postgres 16.15, `worker_app`'s column UPDATE grants on `marketing_enquiry_message` are exactly `subject`, `body`, `attachments` and `review_reason`. `has_column_privilege(…,'review_reason','UPDATE')` is true. Table-level UPDATE, INSERT, DELETE and TRUNCATE are all false.
   - `worker_app` already held SELECT, INSERT and UPDATE on `domain_events`, with DELETE and TRUNCATE false. The event scrub uses that existing UPDATE, and nothing on `domain_events` was widened.
   - `api_app`'s privileges on `marketing_enquiry_message` and `domain_events` are its existing default of ALL PRIVILEGES. This PR did not change them.
   - `apps/worker/src/anonymisation/enquiry-erasure-role.integration.test.ts` passes 14/14 as `worker_app`: the original 13 tests plus the new event-scrub test at `:213`.
   - The `worker_app` role contract passes 46/46 when run the way CI runs it. CI's `worker-role-contract` job is green on this head.
2. **Review reasons in events: fixed and tested.**
   - `scrubReviewReasonEvents` (`anonymise-enquiries.ts:391`) replaces only `reviewReason` with `[Removed]`. It covers attach events on the erased enquiries and attach or discard events for the held mail that erasure deletes, both the mail from the erased address (`:87`) and the mail suspected to belong to an erased enquiry (`:144`–`:148`). It leaves other payload keys, other people's events and rows that were already scrubbed alone.
   - The aggregate types and payload keys it matches are the ones the service publishes (`enquiry-quarantine.service.ts`: `marketing_enquiry` with `quarantineId` on attach, and `enquiry_inbound_quarantine` on discard).
   - It is tested as `api_app` (`anonymise-enquiries.api-app.integration.test.ts`, including an "untouched" event belonging to another person) and as `worker_app` (`enquiry-erasure-role.integration.test.ts:213`). The worker rule is flagged `readsEventLog` (`apps/worker/src/anonymisation/bid-personal-data-policy.ts:120`), and the ordering guard still passes.
   - The dialog hints exist in the copy file (`enquiry-email-copy.ts:128`, `:150`), and `lint:client-copy` passes 21/21.
3. **Attach against a concurrent erasure: fixed and tested.**
   - Inside the transaction, the attach re-reads the target with `SELECT … FOR UPDATE` (`enquiry-quarantine.service.ts:163`, `drizzle-enquiry-inbound.repository.ts:38`). It does this before it locks the held row, and it refuses with `enquiry_erased` or `enquiry_not_found`.
   - Erasure now reads its enquiries `FOR UPDATE` before it touches held mail (`anonymise-enquiries.ts:74`), so the two paths take their locks in the same order.
   - Unit tests cover the re-check, the not-found case and the lock order (`enquiry-quarantine.service.test.ts:371` onwards). The `api_app` integration test shows that an attach which locks while an erasure is still open waits for it, then reads the erased row.
   - The sender comparison now uses the re-read address.

## First-review fixes 1 to 9

All still hold on `1a8a2e97`:
- `api_app` on `enquiry_inbound_quarantine` still has INSERT, SELECT and DELETE, with UPDATE only on the review columns.
- The identity boundary script fix is still in place, and its CI job is green.
- Unverified senders still need explicit confirmation and a reason to be attached.
- The reason validator (3 to 500 characters) is unchanged.
- Attaching to an erased enquiry is still refused.
- The Sentry slug docs are unchanged.
- SPF trust and alignment are unchanged.
- Copy is still in `enquiry-email-copy.ts`.
- Erasure by address still runs before the early return. It now runs after the `FOR UPDATE` read, and still before any early return.

## Checked and fine

- **No IDOR:** the capability checks and `canViewEnquiry` handling are unchanged. A target that cannot be viewed, or no longer exists, gets the same refusal as before.
- **No PII in logs or URLs:** the new refusal codes carry no data.
- **Deadlock:** the attach and the erasure take their locks in the same order (enquiry, then held mail). Discard locks only the held row.
- **Attribution:** none of the nine PR commits, nor the PR title or body, contains a Co-Authored-By, Claude-Session or generated-by line.

## What was run

- **Setup:** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Postgres 16.15 on a local cluster, with `db:migrate`, the worker role probe seed and `db:roles`, and the role passwords set as in CI.
- **Tests** (`--maxWorkers=2` unless noted):
  - db: `worker-app-role` and `api-app-role` contracts and `migrate-roles`: 137 passed.
  - persistence: `enquiry` and `anonymis`: 81 passed and 1 failed (finding 5). With `--maxWorkers=1` all 82 passed, and the failing file passes 7/7 on its own. This includes the `api_app` erasure integration test (4/4).
  - worker: the container, store and inline-db role contracts, `src/anonymisation/` and `src/jobs/` as `worker_app`: 801 passed. This includes `enquiry-erasure-role.integration.test.ts` 14/14.
  - api: `src/services/marketing-enquiry` and `src/routes`: 2,522 passed.
  - web: `components/admin/enquiries`, `lib/admin/enquiries` and `src/app`: 412 passed.
  - domain marketing-enquiry: 74 passed. validators: 679 passed. types: 333 passed.
- **Typecheck:** 70 of 70 turbo tasks passed (api, web, worker, persistence and db, with their dependencies).
- **Lint:** `biome check .` is clean (17,335 files). `lint:client-copy` passes 21/21, and `lint:layers` passes.
- **Build:** a local turbo build of web, api and worker passed 37 of 37 tasks.
- **CI** (REST check-runs for `1a8a2e97`, after every run had finished): every check passed except `build` (the runner lost contact) and `ci-result`. `art-browser-gates` was skipped.
