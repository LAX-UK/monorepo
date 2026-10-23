-- LAX-wide address book, owned by Identity. Bid's per-product "user_address" table is copied
-- into it here; Bid reads and writes through the issuer from now on, and the old table is kept
-- (read-only fallback) until a later change drops it.
--
-- Additive: a new table plus a function replacement, so the running services keep working until
-- they restart. The copy keeps each address's id, so an address id a client already holds still
-- resolves, and is idempotent (re-running adds only what is missing).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_address" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "recipient_name" text NOT NULL,
  "line1" text NOT NULL,
  "line2" text,
  "city" text NOT NULL,
  "region" text,
  "postcode" text NOT NULL,
  "country" text NOT NULL,
  "phone" text,
  "is_default_shipping" boolean DEFAULT false NOT NULL,
  "is_default_billing" boolean DEFAULT false NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "identity_address_country_iso" CHECK ("country" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "identity_address_subject_idx" ON "identity_address" ("subject_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_address_default_shipping_uidx"
  ON "identity_address" ("subject_id") WHERE "is_default_shipping";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "identity_address_default_billing_uidx"
  ON "identity_address" ("subject_id") WHERE "is_default_billing";
--> statement-breakpoint
-- Copy Bid's saved addresses. Legacy countries were free text; an ISO code is kept as it is and
-- the common spellings of the United Kingdom and United States are mapped. Anything else stays
-- only in "user_address" and is picked up by `pnpm --filter @auction/db db:backfill-identity-addresses`,
-- which knows every country name. Addresses of people whose account has already been scrubbed
-- are not copied. The recipient defaults to the person's name, which Bid never recorded per address.
INSERT INTO "identity_address" (
  "id", "subject_id", "label", "recipient_name", "line1", "line2", "city", "region",
  "postcode", "country", "created_at", "updated_at"
)
SELECT
  ua."id", ua."user_id", ua."label", COALESCE(NULLIF(btrim(u."name"), ''), ua."label"), ua."line1", ua."line2", ua."city", ua."state",
  ua."postal_code",
  CASE
    WHEN upper(btrim(ua."country")) = 'UK' THEN 'GB'
    WHEN upper(btrim(ua."country")) ~ '^[A-Z]{2}$' THEN upper(btrim(ua."country"))
    WHEN lower(btrim(ua."country")) IN (
      'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'
    ) THEN 'GB'
    WHEN lower(btrim(ua."country")) IN ('united states', 'united states of america', 'usa')
      THEN 'US'
  END,
  ua."created_at", ua."created_at"
FROM "user_address" ua
JOIN "user" u ON u."id" = ua."user_id"
WHERE u."email" <> 'deleted+' || u."id" || '@purged.invalid'
  AND (
    upper(btrim(ua."country")) ~ '^[A-Z]{2}$'
    OR lower(btrim(ua."country")) IN (
      'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland',
      'united states', 'united states of america', 'usa'
    )
  )
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Bid had one default and a type per address; the address book has a default for shipping and one
-- for billing. A default of type "both" becomes both defaults, and the newest default wins when
-- a person somehow has more than one. A person who already has a default keeps it.
UPDATE "identity_address" ia
SET "is_default_shipping" = true
FROM (
  SELECT DISTINCT ON (ua."user_id") ua."id"
  FROM "user_address" ua
  JOIN "identity_address" copied ON copied."id" = ua."id"
  WHERE ua."is_default" AND ua."address_type" IN ('shipping', 'both')
  ORDER BY ua."user_id", ua."created_at" DESC, ua."id" DESC
) pick
WHERE ia."id" = pick."id"
  AND NOT EXISTS (
    SELECT 1 FROM "identity_address" x
    WHERE x."subject_id" = ia."subject_id" AND x."is_default_shipping"
  );
--> statement-breakpoint
UPDATE "identity_address" ia
SET "is_default_billing" = true
FROM (
  SELECT DISTINCT ON (ua."user_id") ua."id"
  FROM "user_address" ua
  JOIN "identity_address" copied ON copied."id" = ua."id"
  WHERE ua."is_default" AND ua."address_type" IN ('billing', 'both')
  ORDER BY ua."user_id", ua."created_at" DESC, ua."id" DESC
) pick
WHERE ia."id" = pick."id"
  AND NOT EXISTS (
    SELECT 1 FROM "identity_address" x
    WHERE x."subject_id" = ia."subject_id" AND x."is_default_billing"
  );
--> statement-breakpoint
-- The GDPR scrub also removes the address book (home addresses are personal data).
CREATE OR REPLACE FUNCTION public.user_pii_purge(p_user_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public."user" SET
    name = '[deleted]',
    email = 'deleted+' || p_user_id || '@purged.invalid',
    image = NULL,
    pending_new_email = NULL,
    email_change_old_ok = false,
    email_change_new_ok = false,
    email_change_expires_at = NULL,
    updated_at = now()
  WHERE id = p_user_id;
  DELETE FROM public."identity_address" WHERE subject_id = p_user_id;
END;
$$;
