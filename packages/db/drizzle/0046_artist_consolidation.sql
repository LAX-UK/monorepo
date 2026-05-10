-- Artist consolidation: collapse the legacy `marketing_details->>'sellerArtistId'`
-- attribution into the canonical `lot.artist_id` FK, repoint `artist_watchlist`
-- from `user.id` to `artist_profile.id`, and stage anything that cannot be
-- mapped automatically into `admin_review_task` (kind = lot_artist_backfill)
-- so curators handle it manually.
--
-- All steps are idempotent (`WHERE artist_id IS NULL`, `IF EXISTS`, etc.) so
-- re-running the migration is safe. The companion rollback at
-- `0046_rollback.sql` reverses the column-type change on `artist_watchlist`.

-- Step 1: backfill lot.artist_id from marketingDetails.sellerArtistId.
-- Only fills NULL FKs and only when the JSON value is a syntactic uuid that
-- actually exists in the `artist_profile` registry. Stale or malformed JSON
-- values are surfaced via the `lot_artist_backfill` review queue instead of
-- being silently dropped.
UPDATE "lot"
SET artist_id = (marketing_details->>'sellerArtistId')::uuid,
    updated_at = now()
WHERE artist_id IS NULL
  AND marketing_details ? 'sellerArtistId'
  AND marketing_details->>'sellerArtistId' ~* '^[0-9a-f-]{36}$'
  AND EXISTS (
    SELECT 1 FROM "artist_profile" ap
    WHERE ap.id = (marketing_details->>'sellerArtistId')::uuid
  );

-- Step 2: clear the now-redundant JSON copy on rows where the FK is set.
-- This is the start of the deprecation window for `marketingDetails.sellerArtistId`.
UPDATE "lot"
SET marketing_details = marketing_details - 'sellerArtistId',
    updated_at = now()
WHERE artist_id IS NOT NULL
  AND marketing_details ? 'sellerArtistId';

-- Step 3: gate publishing on any lot pointing at a non-approved artist so the
-- catalogue review queue picks them up before they go live.
UPDATE "lot" l
SET artist_review_required = true,
    updated_at = now()
FROM "artist_profile" ap
WHERE l.artist_id = ap.id
  AND ap.status <> 'approved'
  AND l.artist_review_required = false;

-- Step 4: surface lots whose JSON pointed at a non-existent or non-uuid value
-- so curators can manually attach the right artist via the picker.
INSERT INTO "admin_review_task" (kind, status, payload, target_lot_id)
SELECT 'lot_artist_backfill',
       'pending',
       jsonb_build_object(
         'reason', 'invalid_seller_artist_id',
         'legacy_value', marketing_details->>'sellerArtistId'
       ),
       id
FROM "lot"
WHERE artist_id IS NULL
  AND marketing_details ? 'sellerArtistId'
  AND NOT EXISTS (
    -- Skip if a pending task already exists for this lot.
    SELECT 1 FROM "admin_review_task" t
    WHERE t.target_lot_id = "lot".id
      AND t.kind = 'lot_artist_backfill'
      AND t.status IN ('pending', 'in_progress')
  );

-- ---------------------------------------------------------------------------
-- Step 5: repoint artist_watchlist.artist_id from user.id (text) to
-- artist_profile.id (uuid). The original column was a text FK to user.id,
-- which conflated the consignor user with the catalogue artist. We migrate by
-- adding a uuid staging column, mapping rows where an artist_profile already
-- has the legacy user as its `owner_user_id`, surfacing unmapped rows for
-- review, then swapping the columns.
-- ---------------------------------------------------------------------------

DO $artist_watchlist_repoint$
DECLARE
  needs_repoint boolean;
BEGIN
  SELECT (
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'artist_watchlist' AND column_name = 'artist_id'
  ) <> 'uuid' INTO needs_repoint;

  IF NOT needs_repoint THEN
    RETURN;
  END IF;

  -- Staging column for the new FK.
  ALTER TABLE "artist_watchlist"
    ADD COLUMN IF NOT EXISTS artist_profile_id uuid;

  -- Map watchlist rows whose legacy `artist_id` (a user.id) matches an
  -- existing `artist_profile.owner_user_id`.
  UPDATE "artist_watchlist" aw
  SET artist_profile_id = ap.id
  FROM "artist_profile" ap
  WHERE ap.owner_user_id = aw.artist_id
    AND aw.artist_profile_id IS NULL;

  -- Surface every unmappable row so a curator can either delete or repoint it.
  -- We avoid `target_lot_id` because the row is not lot-scoped; the legacy
  -- watchlist id and value go into the payload.
  INSERT INTO "admin_review_task" (kind, status, payload)
  SELECT 'lot_artist_backfill',
         'pending',
         jsonb_build_object(
           'reason', 'artist_watchlist_unmapped',
           'watchlist_id', id,
           'legacy_artist_user_id', artist_id,
           'follow_user_id', user_id
         )
  FROM "artist_watchlist"
  WHERE artist_profile_id IS NULL;

  -- Drop the unmapped rows so we can swap the column type. The dump above is
  -- preserved in `admin_review_task` for ops follow-up.
  DELETE FROM "artist_watchlist" WHERE artist_profile_id IS NULL;

  -- Drop indexes / unique that reference the legacy text column. Constraint
  -- names follow drizzle defaults; use `IF EXISTS` for idempotency.
  ALTER TABLE "artist_watchlist"
    DROP CONSTRAINT IF EXISTS "artist_watchlist_artist_id_user_id_fk";
  ALTER TABLE "artist_watchlist"
    DROP CONSTRAINT IF EXISTS "artist_watchlist_user_artist_uid";
  DROP INDEX IF EXISTS "artist_watchlist_user_artist_uid";
  DROP INDEX IF EXISTS "artist_watchlist_artist_id_idx";

  -- Swap columns.
  ALTER TABLE "artist_watchlist" DROP COLUMN artist_id;
  ALTER TABLE "artist_watchlist" RENAME COLUMN artist_profile_id TO artist_id;
  ALTER TABLE "artist_watchlist" ALTER COLUMN artist_id SET NOT NULL;

  -- Re-add the FK, this time pointing at artist_profile.
  ALTER TABLE "artist_watchlist"
    ADD CONSTRAINT "artist_watchlist_artist_id_artist_profile_fk"
      FOREIGN KEY (artist_id) REFERENCES "artist_profile"(id) ON DELETE CASCADE;

  -- Recreate indexes.
  CREATE UNIQUE INDEX IF NOT EXISTS "artist_watchlist_user_artist_uid"
    ON "artist_watchlist" (user_id, artist_id);
  CREATE INDEX IF NOT EXISTS "artist_watchlist_artist_id_idx"
    ON "artist_watchlist" (artist_id);
END
$artist_watchlist_repoint$;
