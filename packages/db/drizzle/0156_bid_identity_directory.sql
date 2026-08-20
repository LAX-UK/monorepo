-- Introduce the Bid-local Identity directory while worker_app still has its
-- staged read grant on public.user. The projector can be deployed and caught up
-- before migration 0157 removes that source-table access.
CREATE TABLE IF NOT EXISTS "bid_identity_directory" (
  "subject_id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "image" text,
  "phone" text,
  "email_verified" boolean DEFAULT false NOT NULL,
  "deletion_requested_at" timestamp with time zone,
  "merged_into_subject_id" text,
  "identity_created_at" timestamp with time zone NOT NULL,
  "replicated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_event_id" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_email_idx"
  ON "bid_identity_directory" ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_phone_idx"
  ON "bid_identity_directory" ("phone");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_identity_directory_merged_into_idx"
  ON "bid_identity_directory" ("merged_into_subject_id");
--> statement-breakpoint
INSERT INTO "bid_identity_directory" (
  "subject_id",
  "email",
  "name",
  "image",
  "phone",
  "email_verified",
  "deletion_requested_at",
  "merged_into_subject_id",
  "identity_created_at",
  "replicated_at",
  "last_event_id"
)
SELECT
  u."id",
  u."email",
  u."name",
  u."image",
  u."phone_number",
  u."email_verified",
  u."deletion_requested_at",
  u."merged_into_subject_id",
  u."created_at",
  now(),
  0
FROM "user" AS u
ON CONFLICT ("subject_id") DO NOTHING;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'worker_app') THEN
    GRANT INSERT, SELECT, UPDATE, DELETE ON TABLE public.bid_identity_directory TO worker_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_app') THEN
    GRANT SELECT ON TABLE public.bid_identity_directory TO api_app;
  END IF;
END;
$$;
