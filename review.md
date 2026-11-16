Verdict: FIX FIRST

# Security and design review: PR #1479, enquiry replies by email, part B

Reviewed head: `ffa75e06` on `enquiry-inbound-replies-part-b` (2 commits), against `origin/main` at `a54b584f`. The PR merges cleanly. Its merge base is `8f8da613`, and main has one newer commit, #1473, a staff-kit change with no migration. The flag `ENQUIRY_INBOUND_REPLIES_ENABLED` stays off by default.

Most of the security design is sound. The quarantine routes check capabilities on the server, the scope is enforced in SQL, and the target enquiry is checked with `canViewEnquiry`. Each review happens once, under a row lock, and is audited with the actor. The body cap is streamed, a route test pins the flag check, and the purge is bounded and idempotent. Logs and events carry no PII, and rendering is plain text only.

Three items block merging. The first breaks staff-run enquiry erasure. The second leaves CI red because of this PR. The third lets an attached email that failed the sender checks show on the thread as an ordinary client reply.

## Findings

1. **BLOCKING: the tightened `api_app` grants break staff-run enquiry erasure.**
   `packages/db/src/migrate-roles.ts:1640` now grants `api_app` only INSERT and SELECT on `enquiry_inbound_quarantine`, plus UPDATE on three columns. `db:roles` first revokes all privileges and then grants, so existing databases lose DELETE too.
   But the Bid API's own erasure path deletes quarantine rows as `api_app`. That path is Data requests › erase enquiries: `admin-data-requests.service.ts` → `EnquiryErasureService` → `DrizzleEnquiryErasureRepository` (`apps/api/src/container/create-marketing-enquiry-services.ts:194`) → `anonymiseEnquiries`, which deletes at `packages/persistence/src/lib/anonymise-enquiries.ts:116` and `:120`.
   Probed as the real roles: on Postgres 16 after `db:migrate` and `db:roles`, `packages/persistence/src/lib/anonymise-enquiries.integration.test.ts` passes 18/18 as the owner. Run as `api_app`, it fails 18/18 with `42501 permission denied for table enquiry_inbound_quarantine` on the delete by `suspected_enquiry_id`. Any erasure that matches an enquiry rolls back, so staff can no longer complete an erasure request. The worker's erasure policy runs as `worker_app`, which keeps DELETE, so that path is not affected.
   The PR's own api_app test asserts that DELETE is refused (`drizzle-enquiry-inbound-review.repository.integration.test.ts:224`, and the api_app role contract), so this was missed rather than chosen.
   Fix, either way:
   - Keep DELETE for `api_app` on this table. INSERT, SELECT and DELETE, plus column UPDATE, still blocks rewrites of received content.
   - Or move the API's quarantine deletes into a path that runs as a role that holds DELETE.

   Then add an `api_app` run of the erasure integration test (or a role-contract assertion) so this is pinned.
   On "no migration": doing the grant change in `migrate-roles.ts` is the right mechanism for this repo, because grants are applied by `db:roles`, not by migrations. The PR does add migration `0398` for the columns and checks (see Migration below). Only the grant content is wrong.

2. **BLOCKING: CI is red because of this PR (identity boundary conformance, browser-gates, ci-result).**
   Both jobs fail in `scripts/ci/verify-identity-boundary.mjs:90` with "unable to enumerate repository files". `spawnSync("git", ["ls-files", …])` runs with Node's default 1 MiB `maxBuffer`.
   Measured: the file listing is 1,047,783 bytes on main and 1,055,609 bytes on this head. A local run reports `ENOBUFS`. The 64 screenshot paths under `docs/pr-evidence/enquiry-replies-part-b`, plus the new source files, push it over the limit. Main has passed only because it sits about 800 bytes under the limit.
   Fix: pass a larger `maxBuffer` (for example 64 MiB) to that `spawnSync`, in this PR or in a small PR ahead of it. Then re-run CI. All other check runs on `ffa75e06` passed, including api/web vitest, static-checks, build and the worker/auth role contracts. `art-browser-gates` was skipped.

3. **BLOCKING: an email that failed the sender checks can be attached and then reads as a normal client reply.**
   Attaching does not bypass the rules invisibly at the data level. The message row keeps `matched_by = 'staff'` and the SPF/DKIM results, and the event records the held reason. But the staff UI makes it silent in two places:
   - The thread shows every reply authored by the enquirer's name with the "via email" label (`apps/web/src/lib/admin/enquiries/enquiry-replies.ts:48`, `:54`). A `sender_mismatch` or `unauthenticated` email attached by staff looks the same as a verified reply. Only the History entry says "Attached by staff from held email", and SPF/DKIM is not shown on the record at all.
   - The confirmation (`apps/web/src/lib/admin/enquiries/enquiry-email-copy.ts:99`) says the email "joins the enquiry's thread as a reply from the client". It does not repeat why the email was held or that the sender differs. See the evidence screenshot `quarantine-attach-375-dark.png`, which shows a "Different sender" email.

   Fix:
   - Label staff-attached messages on the thread, for example "Attached by staff · sender not verified", with the held reason and the sender address when it differs from the enquirer's.
   - Name the held reason in the attach confirmation for any reason other than `unmatched`.
   - Optionally add the SPF/DKIM results to the `inbound_attached` event payload, which holds codes only.

4. Should fix: the audit records who and when, but no "why".
   `marketing_enquiry.inbound_attached` and `.inbound_discarded` (`apps/api/src/services/marketing-enquiry/enquiry-quarantine.service.ts:158`, `:192`) carry `actorUserId`, ids, the held reason and whether the target was the suspected enquiry. Staff cannot record a reason. At least for attaching to a non-suspected enquiry, or attaching a `sender_mismatch`, `unauthenticated` or `spf_failed` email, consider a short required reason (a code, or capped text kept out of the event's PII allowlist).

5. Should fix: staff can attach held mail to an erased enquiry.
   `attach` takes any enquiry the viewer can open (`enquiry-quarantine.service.ts:132`), including one already anonymised. After an erasure, a later email to the old reply address is held as `sender_mismatch`, because the stored address is the erased placeholder. Its suspected enquiry is the erased record, and the dialog pre-selects it, so one click files new personal text onto the erased record and marks it as waiting for an answer. Refuse attaching to an erased enquiry, and show such mail as unmatched.

6. Should fix: the Sentry cron slug is not documented.
   The job checks in under `purge-enquiry-inbound-quarantine` (`apps/worker/src/workers/register-purge-workers.ts:95`). The repo convention (see `docs/runbooks/monitoring-alerts.md`, for example the `purge-failed-job-payloads` entry) is to say "add `<slug>` to `SENTRY_MONITOR_SLUGS` and create the cron monitor (daily 03:40 Europe/London, about 30 minutes margin)". Without that entry the job runs unmonitored. Add it to the runbook and to `docs/integrations/postmark-inbound.md` under "Turning it on".

7. Hardening: the SPF result is trusted from the first `Received-SPF` header with no check of who wrote it, and SPF is not aligned.
   `apps/api/src/services/marketing-enquiry/inbound-authentication.ts:28`. DKIM is pinned to a configured authserv-id; SPF is not. If the receiving side ever omits its own `Received-SPF` header, a header the sender wrote becomes the first one. Also, an SPF pass covers the envelope sender's domain, not the From domain, so an unaligned SPF pass is accepted. A valid reply token or a quoted message id is still required, which limits the risk. The rule matches the approved wording ("SPF pass or aligned DKIM pass"). Before enabling, consider:
   - requiring `Received-SPF` to carry the receiver's own marker;
   - requiring the SPF-checked domain (`envelope-from` / `smtp.mailfrom`) to align with the From domain.

   `domainsAlign` uses a plain suffix check rather than the public suffix list. That is acceptable for now, but note it.

8. Minor (copy): two strings are hard-coded outside the copy file.
   `"That did not go through"` appears in `attach-quarantined-dialog.tsx:73` and `discard-quarantined-dialog.tsx:32`, and the page metadata strings are in `app/admin/(platform)/enquiries/quarantine/**/page.tsx`. `lint:client-copy` passes, but the PR says all copy lives in `enquiry-email-copy.ts`. Move them there.

9. Non-blocking (erasure scope): the address-based quarantine delete runs only after the early return at `anonymise-enquiries.ts:89`.
   A data subject with no erasable enquiry (none matched, or all held) keeps any unmatched held mail from their address until `purge_at`, up to 30 days. That is acceptable given the bounded retention, but worth a comment, or move the address delete above the early return.

## Checked and fine

- **No IDOR:**
  - Every read, attach and discard runs through `requireEnquiries`. Attach and discard also need `requireEnquiryWork` (`ENQUIRY_ASSIGN_ACCESS`), and the service checks `canAssign` again.
  - The held row is loaded with an SQL scope: private-sale suspects need private-sale read access; unmatched rows and general enquiries need general read access.
  - The target is checked with `canViewEnquiry`, and the refusal is the same as for a missing enquiry.
  - The web server actions also call `denyUnlessAdminCapability`, and the pages use `requireAdminCapability`.
- **Single review:** `SELECT … FOR UPDATE OF q`, a pending check, an update guarded by `status = 'pending'`, and the event in the same transaction. The message insert reuses the provider message id, so it is unique.
- **Auto-filing rule:** a reply is filed only when SPF passed or an aligned DKIM signature passed. Both results are recorded on filed and held rows, with CHECK constraints.
- **Body cap:** `readBodyCapped` streams and cancels the read once the body passes the cap. There is a test for a chunked body with no Content-Length.
- **Flag check:** pinned by route tests for flag off with the service wired, and flag on with no service.
- **Purge:** keyset batches of 500, a ceiling of 1,000 batches, delete by selected ids with `RETURNING`, and logs of counts only. The registry has 3 attempts with backoff. The `purge_at` index already exists from 0397. As `worker_app`, the integration test passes, deletes due rows only and is idempotent.
- **No PII:** URLs use uuid/cursor/reference only. Events carry ids and codes, with allowlists updated, and logs carry counts.
- **Rendering:** plain text throughout. There is no `dangerouslySetInnerHTML` in the new components or the kit changes, and files are listed as metadata with nothing to open.
- **UI:**
  - Screenshots cover loading, empty, error, view-only and reviewed states at 375 and 1440, in light and dark.
  - Only the shared kit is used: `FileMetadataList` and the `MessageThread` additions are in `@auction/staff-ui`.
  - `ConfirmActionDialog` is used for both irreversible actions.
- **Outbound staff replies:** not included, so no From-address question arises. The record's notice tells staff to reply from their own mail.
- **Attribution:** neither commit message nor the PR title or body contains Co-Authored-By, Claude-Session or generated-by lines. Both commits are authored by the repo owner identity.

## Migration

`0398_enquiry_inbound_review` uses journal idx 390, `when` 1812628800000, after 0397 (idx 389). It adds the `spf_result`/`dkim_result` columns and their checks, `matched_by = 'staff'`, and the `unauthenticated` reason. `0398_rollback.sql` deletes the ledger row at the matching `when` and has BEGIN/COMMIT on their own lines. The rollback deletes staff-attached messages and returns those held rows to pending, as documented. The apply/rollback/re-apply integration test passes on Postgres 16.

## What was run

- **Setup:** `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm -r --filter './packages/**' build`. Postgres 16 was a local cluster on port 55432, with `db:migrate` and `db:roles`.
- **Tests** (`--maxWorkers=2`):
  - api quarantine routes, webhooks, marketing-enquiry services, `read-body-capped` and env: 26 files, 251 tests passed.
  - web `components/admin/enquiries` and `lib/admin/enquiries`: 139 passed.
  - staff-ui `src/display`: 130 passed.
  - domain marketing-enquiry: 71 passed.
  - db `api_app`/`worker_app` role contracts and `migrate-roles`: 135 passed. Migration 0397/0398 unit tests passed, and the 0398 integration test passed against a fresh database.
  - persistence inbound and review repositories plus anonymisation, as the owner: 60 passed. The review repository as `api_app`: 6 passed.
  - worker purge job unit test passed, and the purge repository as `worker_app` passed.
  - **Anonymisation integration as `api_app`: 18 of 18 failed (finding 1).**
- **Typecheck** passed for api, web, worker, persistence, db, staff-ui, domain, validators, types and queues (44 turbo tasks).
- **Lint:** `biome check .` is clean. These pass: `lint:client-copy`, `lint:layers`, `lint:deps`, `lint:admin-capability-drift`, `lint:ui-guardrails`, `lint:web-guardrails`, `lint:staff-legacy-shell`, `lint:staff-list-template`, `lint:lib-admin-boundaries`, `lint:datetime` and `lint:test-mocks`.
- **CI** (REST check-runs for `ffa75e06`): everything passed except `identity boundary conformance` and `browser-gates`, which fail on the same `ENOBUFS` (finding 2), and the `ci-result` aggregate. The PR's `mergeable_state` is `blocked`.
