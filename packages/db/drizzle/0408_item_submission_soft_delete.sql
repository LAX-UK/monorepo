-- GAP-53, Delete draft (docs/design/decision-pack-2026-11-17.md, section 5, PR plan 2): a client
-- deletes a draft they never sent. The draft is soft-deleted at once and hard-deleted, with its
-- photos, by the purge job 30 days later, so support can restore one in between.
--   item_submission gains deleted_at: when the draft was deleted. Every reader of the account's
--   submissions leaves rows with it set out. Only a draft is ever deleted (the API refuses others),
--   and the check below holds that for every row.
-- Additive: the column is nullable with no default, so no row is rewritten and the running release
-- (which neither reads nor writes it) keeps working until it restarts. No index: the purge reads
-- drafts through item_submission_status_created_at_idx (status first), and drafts are few.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "item_submission" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
-- Every existing row has deleted_at NULL, so the check holds for all of them and is added NOT VALID:
-- no scan of item_submission while it is locked. New and changed rows are checked from now on.
ALTER TABLE "item_submission" DROP CONSTRAINT IF EXISTS "item_submission_deleted_draft_check";
--> statement-breakpoint
ALTER TABLE "item_submission"
  ADD CONSTRAINT "item_submission_deleted_draft_check" CHECK (
    "deleted_at" IS NULL OR "status" = 'draft'
  ) NOT VALID;
