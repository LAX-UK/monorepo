-- Prevent concurrent consent writes between duplicate cleanup and index creation.
LOCK TABLE "oauth_consent" IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
-- Better Auth persists its string[] scope field as JSON text. Build a
-- deterministic union of every duplicate row's grants, while accepting the
-- historical space-delimited representation as a migration fallback.
CREATE TEMP TABLE "_migration_0143_oauth_consent_merge" AS
WITH ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY "client_id", "user_id"
      ORDER BY "updated_at" DESC, "created_at" DESC, "id" ASC
    ) AS rn,
    count(*) OVER (PARTITION BY "client_id", "user_id") AS duplicate_count
  FROM "oauth_consent"
),
scope_tokens AS (
  SELECT
    consent."client_id",
    consent."user_id",
    token.scope
  FROM "oauth_consent" AS consent
  LEFT JOIN LATERAL jsonb_array_elements_text(
    CASE
      WHEN left(ltrim(consent."scopes"), 1) = '[' THEN consent."scopes"::jsonb
      ELSE to_jsonb(regexp_split_to_array(trim(consent."scopes"), '\s+'))
    END
  ) AS token(scope) ON true
),
merged_scopes AS (
  SELECT
    "client_id",
    "user_id",
    coalesce(
      jsonb_agg(DISTINCT scope ORDER BY scope) FILTER (WHERE scope IS NOT NULL AND scope <> ''),
      '[]'::jsonb
    )::text AS merged_scopes
  FROM scope_tokens
  GROUP BY "client_id", "user_id"
),
merged AS (
  SELECT
    consent."client_id",
    consent."user_id",
    merged_scopes.merged_scopes,
    min(consent."created_at") AS merged_created_at,
    max(consent."updated_at") AS merged_updated_at,
    count(*) AS duplicate_count
  FROM "oauth_consent" AS consent
  JOIN merged_scopes
    ON merged_scopes."client_id" = consent."client_id"
   AND merged_scopes."user_id" = consent."user_id"
  GROUP BY consent."client_id", consent."user_id", merged_scopes.merged_scopes
  HAVING count(*) > 1
)
SELECT
  ranked."id" AS survivor_id,
  merged."client_id",
  merged."user_id",
  merged.merged_scopes,
  -- Never revive consent that the user's most recent row revoked.
  ranked."consent_given" AS merged_consent_given,
  merged.merged_created_at,
  merged.merged_updated_at,
  merged.duplicate_count
FROM ranked
JOIN merged
  ON merged."client_id" = ranked."client_id"
 AND merged."user_id" = ranked."user_id"
WHERE ranked.rn = 1
  AND ranked.duplicate_count > 1;
--> statement-breakpoint
DO $$
DECLARE
  affected_groups bigint;
  removed_rows bigint;
BEGIN
  SELECT count(*), coalesce(sum(duplicate_count - 1), 0)
    INTO affected_groups, removed_rows
    FROM "_migration_0143_oauth_consent_merge";
  RAISE NOTICE 'migration 0143: merging % oauth_consent duplicate rows across % client/user groups',
    removed_rows, affected_groups;
END $$;
--> statement-breakpoint
UPDATE "oauth_consent" AS consent
SET
  "scopes" = merge."merged_scopes",
  "consent_given" = merge."merged_consent_given",
  "created_at" = merge."merged_created_at",
  "updated_at" = merge."merged_updated_at"
FROM "_migration_0143_oauth_consent_merge" AS merge
WHERE consent."id" = merge.survivor_id;
--> statement-breakpoint
DELETE FROM "oauth_consent" AS consent
USING "_migration_0143_oauth_consent_merge" AS merge
WHERE consent."client_id" = merge."client_id"
  AND consent."user_id" = merge."user_id"
  AND consent."id" <> merge.survivor_id;
--> statement-breakpoint
DROP TABLE "_migration_0143_oauth_consent_merge";
--> statement-breakpoint
DROP INDEX IF EXISTS "domain_events_user_linked_external_uid";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_consent_client_user_uidx"
  ON "oauth_consent" ("client_id", "user_id");
