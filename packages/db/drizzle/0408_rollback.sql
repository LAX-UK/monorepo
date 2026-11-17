-- Rollback for 0408_item_submission_soft_delete. Roll the release back first: the previous release
-- neither deletes drafts nor reads deleted_at, so a soft-deleted draft would show again in its
-- account. Each was deleted by its client ("This cannot be undone"), so they are removed for good
-- here rather than brought back; their rows' documents, categories and threads go with them (ON
-- DELETE CASCADE). Their photos stay in storage: run the purge job before rolling back to remove
-- them too. Also removes this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

-- Re-runnable, like the other rollbacks: once the column is gone there is nothing to remove, and
-- the statement is run dynamically so it is not planned against a column that no longer exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'item_submission' AND column_name = 'deleted_at'
  ) THEN
    EXECUTE 'DELETE FROM "item_submission" WHERE "deleted_at" IS NOT NULL';
  END IF;
END $$;

ALTER TABLE "item_submission" DROP CONSTRAINT IF EXISTS "item_submission_deleted_draft_check";

ALTER TABLE "item_submission" DROP COLUMN IF EXISTS "deleted_at";

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1813492800000;

COMMIT;
