Verdict: FIX FIRST

# Review: PR #1548, Delete draft (GAP-53, PR plan 2 and 3)

Independent review against `docs/design/decision-pack-2026-11-17.md` section 5 ("Options: delete
draft", option A, and PR plan items 2 and 3). Head reviewed: `c16f31e8f`. Main at review time:
`d087a2900`.

## What was checked

| Requirement | Result |
|---|---|
| Soft delete, drafts only | Pass. A single `UPDATE … WHERE id AND legal_entity_id AND status='draft' AND deleted_at IS NULL` (`packages/persistence/src/repositories/drizzle-item-submission.repository.ts:360`) means a draft that is sent at the same moment is never deleted. A DB check `deleted_at IS NULL OR status = 'draft'` (`0407_item_submission_soft_delete.sql:24-27`, `NOT VALID`, so no scan under the lock) also stops a deleted draft from being sent. Every account reader filters `deleted_at IS NULL`: seller and admin lists and counts, `findById`, `findByIdForUpdate`, `update`, status counts, record search, the consignment inbox joins, and stale-draft reminders. |
| `DELETE /submissions/:id`: 404 for others' drafts | Pass. Another account's draft, a missing id and an already-deleted id give 404 from the repository. A colleague's draft asked for by a consignor gives a `not_sender` refusal, which is mapped to 404 (`apps/api/src/services/submission/submission-seller-http-application.service.ts:195`). Tests: `submission-delete-draft.test.ts:95-106`. |
| 409 for non-drafts | Pass. `not_draft` gives 409 with code `submission_not_a_draft` and "Only a draft can be deleted. To stop a work you sent, withdraw it." (`apps/api/src/services/submission/submission-seller-lifecycle.ts:144`). A colleague's sent work still answers 404 to a consignor, because the policy runs first. |
| Policy: owners, admins and the consignor who made it, as for withdraw | Pass. `delete_draft: { own: "entity.submissions.create", any: "entity.consignments.withdraw" }` is the same pair as `withdraw` (`packages/domain/src/submission-mutation-policy.ts:46`). The matrix test covers all six roles. Finance, viewer and buyer_agent get 403, and so does LAX support viewing as the client. The route also carries `requireBuyerRole` and `requireChangeSubmissions` like withdraw, and is listed in `role-rules.ts`. |
| 30-day purge: row and photos via the storage port; idempotent | Pass, with a note (non-blocking 1). `purgeDeletedDrafts` (`drizzle-item-submission.repository.ts:393`) deletes rows where `status='draft' AND deleted_at < now-30d` in batches of 200, oldest first, and returns their `images`. Documents, categories and threads go by `ON DELETE CASCADE`. Photos go to the existing image-cleanup queue, whose worker deletes them through `UploadStorage` only once no lot, sale or submission still references the key, so photos a draft shares with a source lot or work are kept. A second run removes nothing (`drizzle-item-submission.soft-delete.integration.test.ts`, "Running it again removes nothing more"). It runs daily as a BullMQ repeat job → `POST /internal/jobs/purge-deleted-submission-drafts` behind the cron secret, with 3 attempts. |
| Migration has rollback and test | Pass as written. The rollback is re-runnable, deletes soft-deleted drafts (documented), drops the check and column, and removes its ledger row. There is a unit test, a temporary-database forward → rollback → forward integration test, and `verify-migration-pairs` passes. |
| Migration re-chains after main's latest journal entry (0407 on main) | **Fail**, see finding 1. |
| Confirm dialog copy and destructive button | Pass. "Delete this draft?" / "Its photos and answers are removed. This cannot be undone." / "Delete draft" with `tone="danger"`, and Cancel (`apps/web/src/lib/seller/delete-draft.ts`, `delete-draft-dialog.tsx`). The dialog can't be dismissed while the request is pending, and a refusal shows the API's words. |
| Toast | Pass. "Draft deleted" (`notify.success`). The list refreshes from the row menu, and the draft's page goes back to Consignments. |
| Bid accent, light/dark/375 | Pass from the evidence in `docs/pr-evidence/client-delete-draft/` (20 shots: row menu, confirm, deleted, draft page, page confirm, each at 1440/375 in light and dark). Bid's navy accent is on the active nav, "Delete draft" is the red destructive item last in the menu after a divider, the danger button in dark mode is readable, and nothing overflows at 375. |
| Tests incl. permissions and purge | Pass. Domain policy matrix, API route/service (204/404/409/403, support view, personal account), purge service (batches, failures, nothing due), persistence integration (delete once, readers exclude it, purge with documents, second run no-op), migration unit and integration, worker job, `api_app` grant probe, worker store contract, web row and VM tests, and a Playwright spec (`apps/web/e2e/org-roles-delete-draft.spec.ts`). |

## Findings

### 1. Blocking: migration 0407 collides with main's 0407; it must be renumbered and re-chained

Main already has `0407_consignor_agreement` (#1545, `934d2b40c`) at journal `idx` 399 with
`"when": 1813406400000`, and its own `packages/db/drizzle/0407_rollback.sql`. This PR adds
`0407_item_submission_soft_delete` at the **same `idx` 399 and the same `when` 1813406400000**
(`packages/db/drizzle/meta/_journal.json:2792-2795`), and a second `0407_rollback.sql`.
`git merge-tree origin/main pr1548` reports conflicts in `_journal.json` and `0407_rollback.sql`.

Fixing only the merge conflict isn't enough. The two migrations have the same `when`, so on a
database that has already applied main's 0407, Drizzle's migrator would never apply this one (it only
runs entries newer than the last applied `created_at`). The column and check would be missing, and
every reader that filters `deleted_at` would fail. The rollback's
`DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813406400000`
(`0407_rollback.sql:27`) would also remove **main's** consignor-agreement ledger row.

Fix: rebase onto main and make this `0408_item_submission_soft_delete` at `idx` 400, with a `when`
later than 1813406400000. Rename the rollback to `0408_rollback.sql` and point it at the new `when`.
Update the tests:
- `migration-0407-…test.ts:10`: `PREVIOUS = "0407_consignor_agreement"`.
- The integration test's `THROUGH_0406` (`:15`) becomes "through 0407" at 1813406400000.
- `laterRollbackSql(407)` (`:93`) becomes `laterRollbackSql(408)`.
- Rename the test files and the "0407" mentions in the schema comment and the `api_app` contract test.

## Non-blocking notes

1. **A failed photo hand-off is never retried.** The purge deletes the rows first and then enqueues
   the photo keys (`apps/api/src/services/submission/submission-draft-purge.service.ts:48-63`). If
   `enqueueRemovedMany` throws (Redis blip), the row is already gone, so no later run finds those
   photos. The warning logs only `submissionId`, not the keys, so they can't be cleaned up by hand
   either. This follows the existing lot and sale pattern and is rare. Logging `draft.images` in that
   warning would make it recoverable.
2. **Document files stay in storage.** `submission_document` rows cascade away, but their
   `upload_object` rows and objects (`onDelete: "restrict"` on the FK from document to upload) are
   not cleaned up. The dialog promises "photos and answers", so this isn't a copy defect, but
   uploaded documents on a deleted draft outlive it.
3. **The rollback deletes soft-deleted drafts outright and leaves their photos in storage.** This is
   documented in `0407_rollback.sql:1-6` (run the purge first). Fine as a deliberate choice; just make
   sure the runbook for a rollback says so.
4. Rows say "sent by Lena Fischer" on drafts (visible in the evidence). That's existing row copy,
   not this PR's, but "started by" would read better for a draft.

## Test runs (local, Postgres 16 + Redis, CI env, fresh database migrated with the PR's journal)

- `tsc --noEmit`: `apps/api`, `apps/worker`, `apps/web`, `packages/persistence`: pass.
- `packages/db`: migration 0407 unit and integration and the `api_app` contract file: 6 passed
  (the contract cases skip without an API role URL, as in CI's test job).
- `packages/persistence` soft-delete integration: 2 passed. `packages/domain` policy: 88 passed.
- `apps/api` delete-draft, purge service, internal-cron purge: 17 passed. `apps/worker` purge job:
  3 passed. `apps/web` row and VM tests: 23 passed.
- `scripts/ci/verify-migration-pairs.mjs`: pass.
- Playwright e2e not run here.
