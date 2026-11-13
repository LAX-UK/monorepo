-- One accounting document per LAX reference *per target* (provider and mode) instead of one per
-- reference. A document rehearsed in Books `dry_run` keeps its row (and its history) as it was;
-- when the switch later aims Bid at `test_org` or `live`, the same reference is registered again
-- as a new `pending` document for that target, so the rehearsal never holds a reference the real
-- organisation needs. Rows with no target (nothing could be chosen) are one slot of their own:
-- NULLS NOT DISTINCT keeps at most one such row per reference.
--
-- Safe on existing data: the old index already made (product, legal_entity, lax_reference)
-- unique, so the wider key cannot find a duplicate. The new constraint is created before the old
-- index is dropped, so the reference is never unguarded.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "accounting_document"
  ADD CONSTRAINT "accounting_document_reference_target_uq"
  UNIQUE NULLS NOT DISTINCT ("product", "legal_entity", "lax_reference", "target_provider", "target_mode");
--> statement-breakpoint
DROP INDEX IF EXISTS "accounting_document_reference_uid";
