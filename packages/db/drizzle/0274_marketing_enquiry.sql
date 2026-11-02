-- Public contact form enquiries, stored so none is lost and client services can work them from
-- the staff work inbox.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_enquiry" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "topic" text NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "message" text NOT NULL,
  "source_page" text,
  "status" text DEFAULT 'new' NOT NULL,
  "handled_at" timestamp with time zone,
  "handled_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "marketing_enquiry_status_check" CHECK ("status" IN ('new', 'handled')),
  CONSTRAINT "marketing_enquiry_handled_check" CHECK (("status" = 'handled') = ("handled_at" IS NOT NULL)),
  CONSTRAINT "marketing_enquiry_handled_by_user_id_user_id_fk"
    FOREIGN KEY ("handled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_enquiry_new_created_idx"
  ON "marketing_enquiry" ("created_at")
  WHERE "status" = 'new';
