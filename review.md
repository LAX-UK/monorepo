Verdict: FIX FIRST

# Security recheck: PR #1479, enquiry replies by email, part B (after fixes)

Reviewed head: `bc25b29b` on `enquiry-inbound-replies-part-b`. The head was unchanged for more than 30 minutes before this recheck, and every check run for it had finished. The fix commits are `26a39c3d..bc25b29b`. The first review is the previous version of this file (at `ffa75e06`).

Eight of the nine findings are fixed and verified. The fix for finding 3 added a new column that the worker's scheduled erasure now writes, but `worker_app` was not granted UPDATE on it. Scheduled erasure of a person with an enquiry now fails, and the `worker-role-contract` CI job is red because of it. That one item blocks merging.

## Findings

1. **BLOCKING (new, a regression from the fix for finding 3): scheduled erasure fails as `worker_app`, and CI is red.**
   `packages/persistence/src/lib/anonymise-enquiries.ts:116` now also sets `review_reason` on `marketing_enquiry_message`. But `worker_app` holds UPDATE only on `subject`, `body` and `attachments` there (`packages/db/src/migrate-roles.ts:1134`, `WORKER_ANONYMISATION_SCRUB_COLUMNS`). Postgres checks column privileges for every column in the SET list, even when the CASE leaves the value NULL and even when no row matches. So for any person who has an erasable enquiry, the statement fails with `42501 permission denied for table marketing_enquiry_message` and the whole erasure rolls back. That covers the worker's personal-data policy (`apps/worker/src/anonymisation/bid-personal-data-policy.ts:120`), which is the scheduled erasure path.
   - Probed on Postgres 16 after `db:migrate` and `db:roles`: as `worker_app`, `has_column_privilege('marketing_enquiry_message','review_reason','UPDATE')` is false and `body` is true.
   - `apps/worker/src/anonymisation/enquiry-erasure-role.integration.test.ts` fails 3 of 13 locally with that error. CI's `worker-role-contract` job fails on the same 3 tests, and `ci-result` fails with it.
   - Fix: add `review_reason` to the `marketing_enquiry_message` entry at `migrate-roles.ts:1134`, and pin it in `packages/db/src/worker-app-role.contract.test.ts` and the `migrate-roles` invariants. Then re-run `db:roles` and CI.
   - The PR body says "the `api_app` and `worker_app` role contracts … all pass". The worker erasure integration test, which is the test that covers this, was not in the local run.

2. Should fix: the staff-typed reason is kept in domain events that erasure does not clear.
   `reviewReason` is allowlisted on `marketing_enquiry.inbound_attached` and `.inbound_discarded` (`packages/types/src/domain-event-pii/allowlists.ts:540`, `:543`). Erasure clears the reason on the message row because "it can name the sender" (`anonymise-enquiries.ts:118`), but the same text stays in the event payload. The repo already accepts a staff-typed reason on `marketing_enquiry.erased`, so this follows precedent. Still, either scrub these payloads on erasure, or tell staff in the dialog not to put the sender's details in the reason.

3. Non-blocking: the erased-enquiry check runs before the transaction.
   `apps/api/src/services/marketing-enquiry/enquiry-quarantine.service.ts:144` checks `target.email === ERASED_ENQUIRY.email` on a read made before `runInTransaction` (`:149`). An erasure that commits between the two still lets the attach file the text onto the newly erased record. The window is small and staff-driven. Re-reading or locking the target enquiry inside the transaction would close it.

4. Non-blocking (hardening, documented): SPF still trusts the topmost `Received-SPF` header when its `receiver=` names Postmark's inbound domain.
   `apps/api/src/services/marketing-enquiry/inbound-authentication.ts:72`. If the receiving side ever added no header of its own, a header the sender wrote with that receiver would be the topmost one. The runbook step to check a live test message's header before enabling the flag (`docs/integrations/postmark-inbound.md:57`) covers this, and a valid reply token or quoted message id is still required. Alignment does not use the public suffix list; this is documented.

## First-review findings 1 to 9

1. **Staff-run erasure with least-privilege grants: fixed.** The grants probe was run as the real roles on Postgres 16 after `db:migrate` and `db:roles`. `api_app` on `enquiry_inbound_quarantine`: SELECT, INSERT and DELETE true; table UPDATE, TRUNCATE and UPDATE(`body`) false; UPDATE(`status`) true. `anonymise-enquiries.api-app.integration.test.ts` passes 2/2 as `api_app`. `worker_app` keeps SELECT and DELETE only. (The `worker_app` side broke elsewhere: see new finding 1.)
2. **CI: not met.** `identity boundary conformance` and `browser-gates` now pass. The buffer fix is in `scripts/ci/verify-identity-boundary.mjs`, and its test passes 5/5 locally. `ci-result` is still red because `worker-role-contract` fails (new finding 1). Every other check run on `bc25b29b` passed, and `art-browser-gates` was skipped.
3. **Unverified mail after attach: fixed.** The service refuses an attach with `sender_confirmation_required` unless the sender is verified (the client's address, plus an aligned SPF or DKIM pass and no sender held reason) or `confirmSenderNotVerified` is set. The reason is required either way. The thread shows a warning "Attached by staff · Sender not verified" label with the held reason, a different-address note, the SPF and DKIM results and the reason given (`apps/web/src/lib/admin/enquiries/enquiry-replies.ts:56`). History says the same. The `inbound_attached` event records the SPF and DKIM codes, `senderVerified` and the reason, and never the address.
4. **Reason on attach and discard: fixed.** 3 to 500 characters, trimmed, checked by the shared validator on both the web action and the API route (`packages/validators/src/marketing-enquiry.ts:234`). It is recorded on both events. Also see new finding 2.
5. **Attach to an erased enquiry: fixed** (`enquiry_erased`, a 422). Held mail whose suspect was erased reads as unmatched, and the SQL visibility scope is unchanged, so a private-sale suspect is not exposed. Also see new finding 3.
6. **Sentry cron slug: fixed.** It is in `docs/runbooks/monitoring-alerts.md:242` and in "Turning it on" at `docs/integrations/postmark-inbound.md:56`.
7. **SPF trust and alignment: fixed, with tests.** Only the topmost header whose `receiver=` is the trusted receiver counts. A pass for an unaligned domain is `pass_unaligned` and does not authenticate. DKIM stays pinned to the configured authserv-id. `inbound-authentication.test.ts` covers a forged lower header, a foreign receiver, a look-alike receiver domain, a configured receiver, and unaligned SPF and DKIM.
8. **Copy: fixed.** The strings are in `enquiry-email-copy.ts`, and `lint:client-copy` passes.
9. **Erasure by address before the early return: fixed** (`anonymise-enquiries.ts:65`). It is covered by the `api_app` integration test.

## Checked and fine

- **No IDOR:** capability checks on the routes and server actions are unchanged. The target enquiry is still checked with `canViewEnquiry`, with the same refusal as a missing enquiry. The confirmation flag cannot widen what a person may open.
- **No PII in logs or URLs:** URLs carry ids and references only. Events carry codes, booleans and the staff reason (see new finding 2), and never the sender address.
- **No HTML injection:** `provenance` labels and details render as React text, and there is no `dangerouslySetInnerHTML`.
- **Grants:** none are broader than needed, apart from the documented `api_app` DELETE on held mail. Postgres has no row-level DELETE privilege, so that is the narrowest grant that works. TRUNCATE stays refused. Migration 0398's new columns have CHECKs that tie them to `matched_by = 'staff'` and cap the reason at 500 characters, and the rollback drops them.
- **Attribution:** no commit message (all seven PR commits), and neither the PR title nor the body, contains a Co-Authored-By, Claude-Session or generated-by line.

## What was run

- **Setup:** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Postgres 16 was a local cluster with `db:migrate` and `db:roles`, and the role passwords were set.
- **Tests** (`--maxWorkers=2`):
  - db role contracts, `migrate-roles` and 0397/0398 unit tests: 145 passed. The 0398 apply/rollback/re-apply integration test on a fresh database passed.
  - persistence inbound and review repositories plus anonymisation, including as `api_app`: 65 passed.
  - **worker anonymisation, purge job and purge registration: 132 passed and 3 failed** (new finding 1).
  - domain marketing-enquiry: 74 passed. staff-ui `display`: 131 passed. validators: 679 passed. types: 333 passed.
  - api quarantine routes, webhooks, marketing-enquiry services, `read-body-capped` and env: 268 passed.
  - web `components/admin/enquiries`, `lib/admin/enquiries` and the quarantine actions: 147 passed.
  - identity boundary script test: 5 passed.
- **Typecheck:** 43 of 43 turbo tasks passed (api, web, worker, persistence, db, staff-ui, domain, validators, types and their dependencies).
- **Lint:** `biome check .` is clean, and `lint:client-copy` and `lint:layers` pass.
- **CI** (REST check-runs for `bc25b29b`): all passed except `worker-role-contract` and `ci-result`. `art-browser-gates` was skipped.
