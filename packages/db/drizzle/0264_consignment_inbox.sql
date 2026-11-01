-- Consignment inbox: the staff side of consignment messages. Threads can be closed and covered by
-- a colleague, record who is waiting since when, and keep a short history; staff add internal
-- notes the client never sees, hold a reply for a few seconds so it can be taken back, and share
-- saved replies.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "consignment_thread"
  ADD COLUMN IF NOT EXISTS "closed_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "closed_by_user_id" text,
  ADD COLUMN IF NOT EXISTS "covering_user_id" text,
  ADD COLUMN IF NOT EXISTS "awaiting_since" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "consignment_thread"
  ADD CONSTRAINT "consignment_thread_closed_by_user_id_user_id_fk"
    FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "consignment_thread"
  ADD CONSTRAINT "consignment_thread_covering_user_id_user_id_fk"
    FOREIGN KEY ("covering_user_id") REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
-- A thread waiting on staff has waited since the first client message after the last staff reply.
UPDATE "consignment_thread" AS t
SET "awaiting_since" = COALESCE(
  (
    SELECT min(m."created_at")
    FROM "consignment_message" AS m
    WHERE m."thread_id" = t."id"
      AND m."author_side" = 'client'
      AND m."created_at" > COALESCE(
        (
          SELECT max(s."created_at")
          FROM "consignment_message" AS s
          WHERE s."thread_id" = t."id" AND s."author_side" = 'staff'
        ),
        '-infinity'::timestamp with time zone
      )
  ),
  t."last_message_at"
)
WHERE t."last_message_side" = 'client' AND t."awaiting_since" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_waiting_idx"
  ON "consignment_thread" ("awaiting_since")
  WHERE "closed_at" IS NULL AND "awaiting_since" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_closed_idx"
  ON "consignment_thread" ("closed_at")
  WHERE "closed_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_covering_idx"
  ON "consignment_thread" ("covering_user_id")
  WHERE "covering_user_id" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "consignment_message"
  ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'thread' NOT NULL,
  ADD COLUMN IF NOT EXISTS "deliver_after" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "notified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "consignment_message"
  ADD CONSTRAINT "consignment_message_visibility_check"
    CHECK ("visibility" IN ('thread', 'internal'));
--> statement-breakpoint
ALTER TABLE "consignment_message"
  ADD CONSTRAINT "consignment_message_internal_staff_check"
    CHECK ("visibility" = 'thread' OR "author_side" = 'staff');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_thread_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "actor_user_id" text,
  "subject_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consignment_thread_event_kind_check"
    CHECK ("kind" IN ('assigned', 'unassigned', 'covering', 'closed', 'reopened')),
  CONSTRAINT "consignment_thread_event_thread_id_consignment_thread_id_fk"
    FOREIGN KEY ("thread_id") REFERENCES "public"."consignment_thread"("id") ON DELETE cascade,
  CONSTRAINT "consignment_thread_event_actor_user_id_user_id_fk"
    FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "consignment_thread_event_subject_user_id_user_id_fk"
    FOREIGN KEY ("subject_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consignment_thread_event_thread_idx"
  ON "consignment_thread_event" ("thread_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consignment_saved_reply" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "consignment_saved_reply_body_length_check" CHECK (char_length("body") <= 4000),
  CONSTRAINT "consignment_saved_reply_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "consignment_saved_reply_updated_by_user_id_user_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "consignment_saved_reply_title_uidx"
  ON "consignment_saved_reply" (lower("title"));
