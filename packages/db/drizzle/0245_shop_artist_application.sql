-- Artists apply online to be represented by the gallery and join the artist portal. An
-- application is written on lax.art by a signed-in LAX Account, reviewed in LAX Admin, and on
-- acceptance becomes an artist profile linked to that account. Additive: nothing running reads
-- these tables until the new shop-api is deployed.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TYPE "public"."shop_media_kind" ADD VALUE IF NOT EXISTS 'artist_application_image';
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shop_artist_application_status" AS ENUM (
    'draft', 'submitted', 'in_review', 'more_info_needed', 'accepted', 'declined'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."shop_artist_application_work_kind" AS ENUM ('original', 'edition');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "shop_artist_application_reference_seq" START WITH 10001 MINVALUE 10000;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artist_application" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text DEFAULT ('LAX-AP-' || nextval('shop_artist_application_reference_seq')::text) NOT NULL,
  "applicant_subject_id" text NOT NULL,
  "status" "shop_artist_application_status" DEFAULT 'draft' NOT NULL,
  "artist_name" text,
  "location" text,
  "website" text,
  "social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "short_bio" text,
  "statement" text,
  "representation" text,
  "exhibitions" text,
  "consent_to_contact" boolean DEFAULT false NOT NULL,
  "contact_email" text,
  "assignee_subject" text,
  "message_to_artist" text,
  "artist_id" uuid REFERENCES "shop_artist"("id") ON DELETE restrict,
  "submitted_at" timestamp with time zone,
  "decided_at" timestamp with time zone,
  "version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_artist_application_decided_ck"
    CHECK (("status" IN ('accepted', 'declined')) = ("decided_at" IS NOT NULL)),
  CONSTRAINT "shop_artist_application_submitted_ck"
    CHECK ("status" = 'draft' OR "submitted_at" IS NOT NULL),
  CONSTRAINT "shop_artist_application_accepted_artist_ck"
    CHECK ("status" <> 'accepted' OR "artist_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER SEQUENCE "shop_artist_application_reference_seq" OWNED BY "shop_artist_application"."reference";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_application_reference_uid"
  ON "shop_artist_application" USING btree ("reference");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_application_open_uid"
  ON "shop_artist_application" USING btree ("applicant_subject_id")
  WHERE "status" NOT IN ('accepted', 'declined');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artist_application_applicant_idx"
  ON "shop_artist_application" USING btree ("applicant_subject_id", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artist_application_queue_idx"
  ON "shop_artist_application" USING btree ("status", "submitted_at" DESC, "id" DESC)
  WHERE "status" <> 'draft';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artist_application_work" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "shop_artist_application"("id") ON DELETE cascade,
  "position" integer NOT NULL,
  "media_key" text NOT NULL REFERENCES "shop_media_asset"("key") ON DELETE restrict,
  "title" text,
  "year" integer,
  "medium" text,
  "size" text,
  "kind" "shop_artist_application_work_kind",
  CONSTRAINT "shop_artist_application_work_position_ck" CHECK ("position" >= 0 AND "position" < 12)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_application_work_position_uid"
  ON "shop_artist_application_work" USING btree ("application_id", "position");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_artist_application_work_media_uid"
  ON "shop_artist_application_work" USING btree ("application_id", "media_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_artist_application_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "application_id" uuid NOT NULL REFERENCES "shop_artist_application"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "actor_subject_id" text NOT NULL,
  "message" text,
  "assignee_subject" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_artist_application_event_application_idx"
  ON "shop_artist_application_event" USING btree ("application_id", "created_at");
