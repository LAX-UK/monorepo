-- Rollback for 0046_artist_consolidation.sql.
--
-- The lot.artist_id backfill cannot be cleanly reverted (we deliberately
-- removed the JSON copy). We restore it best-effort by writing the FK back
-- into `marketing_details` so old code paths can still resolve the link.
--
-- The artist_watchlist column type is reversed: uuid → text, and the FK is
-- pointed back at user.id. Rows that survived the forward migration must
-- already have a matching `artist_profile.owner_user_id`, so we resolve back
-- to the user.id; rows where the FK resolution fails are dropped (the audit
-- task in `admin_review_task` is left in place for ops follow-up).

-- Step 1: re-emit sellerArtistId into marketing_details for any FK-attached lot.
UPDATE "lot"
SET marketing_details = jsonb_set(marketing_details, '{sellerArtistId}', to_jsonb(artist_id::text)),
    updated_at = now()
WHERE artist_id IS NOT NULL;

-- Step 2: revert artist_watchlist column type if it was changed.
DO $artist_watchlist_rollback$
DECLARE
  is_uuid boolean;
BEGIN
  SELECT (
    SELECT data_type FROM information_schema.columns
    WHERE table_name = 'artist_watchlist' AND column_name = 'artist_id'
  ) = 'uuid' INTO is_uuid;

  IF NOT is_uuid THEN
    RETURN;
  END IF;

  ALTER TABLE "artist_watchlist" ADD COLUMN IF NOT EXISTS legacy_artist_user_id text;

  UPDATE "artist_watchlist" aw
  SET legacy_artist_user_id = ap.owner_user_id
  FROM "artist_profile" ap
  WHERE ap.id = aw.artist_id
    AND ap.owner_user_id IS NOT NULL;

  -- Drop rows we cannot map back.
  DELETE FROM "artist_watchlist" WHERE legacy_artist_user_id IS NULL;

  ALTER TABLE "artist_watchlist"
    DROP CONSTRAINT IF EXISTS "artist_watchlist_artist_id_artist_profile_fk";
  DROP INDEX IF EXISTS "artist_watchlist_user_artist_uid";
  DROP INDEX IF EXISTS "artist_watchlist_artist_id_idx";

  ALTER TABLE "artist_watchlist" DROP COLUMN artist_id;
  ALTER TABLE "artist_watchlist" RENAME COLUMN legacy_artist_user_id TO artist_id;
  ALTER TABLE "artist_watchlist" ALTER COLUMN artist_id SET NOT NULL;

  ALTER TABLE "artist_watchlist"
    ADD CONSTRAINT "artist_watchlist_artist_id_user_id_fk"
      FOREIGN KEY (artist_id) REFERENCES "user"(id) ON DELETE CASCADE;

  CREATE UNIQUE INDEX IF NOT EXISTS "artist_watchlist_user_artist_uid"
    ON "artist_watchlist" (user_id, artist_id);
  CREATE INDEX IF NOT EXISTS "artist_watchlist_artist_id_idx"
    ON "artist_watchlist" (artist_id);
END
$artist_watchlist_rollback$;
