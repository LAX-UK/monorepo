ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "phone_number_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill canonical phone from legacy mobile (E.164 only).
UPDATE "user"
SET "phone_number" = trim("mobile")
WHERE "phone_number" IS NULL
  AND "mobile" IS NOT NULL
  AND trim("mobile") <> ''
  AND trim("mobile") LIKE '+%';
--> statement-breakpoint
-- Resolve duplicate phone numbers: keep earliest created user, clear others.
WITH ranked AS (
  SELECT
    id,
    phone_number,
    row_number() OVER (
      PARTITION BY phone_number
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM "user"
  WHERE phone_number IS NOT NULL
)
UPDATE "user" u
SET phone_number = NULL
FROM ranked r
WHERE u.id = r.id
  AND r.rn > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_phone_number_uidx" ON "user" ("phone_number") WHERE "phone_number" IS NOT NULL;
