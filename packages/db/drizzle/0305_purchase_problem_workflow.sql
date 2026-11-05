-- Purchase problems become a staff work item: a report can be taken on (in progress), handed to
-- a colleague, carry internal notes, and is resolved by a named person. Existing rows stay valid:
-- every new column is nullable or defaulted, and the status check only gains a value.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "purchase_problem" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" text
  REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "purchase_problem" ADD COLUMN IF NOT EXISTS "resolved_by_user_id" text
  REFERENCES "public"."user"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "purchase_problem" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "purchase_problem" DROP CONSTRAINT IF EXISTS "purchase_problem_status_check";
--> statement-breakpoint
ALTER TABLE "purchase_problem" ADD CONSTRAINT "purchase_problem_status_check"
  CHECK ("status" IN ('open', 'in_progress', 'resolved'));
--> statement-breakpoint
-- One unresolved report per lot and buying account, whether or not someone has taken it on.
DROP INDEX IF EXISTS "purchase_problem_open_uidx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_problem_open_uidx"
  ON "purchase_problem" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" IN ('open', 'in_progress');
--> statement-breakpoint
DROP INDEX IF EXISTS "purchase_problem_open_created_idx";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_problem_open_created_idx"
  ON "purchase_problem" ("created_at")
  WHERE "status" IN ('open', 'in_progress');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_problem_status_created_idx"
  ON "purchase_problem" ("status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_problem_note" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "purchase_problem_id" uuid NOT NULL,
  "author_user_id" text,
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "purchase_problem_note_body_check" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "purchase_problem_note_purchase_problem_id_fk"
    FOREIGN KEY ("purchase_problem_id") REFERENCES "public"."purchase_problem"("id") ON DELETE cascade,
  CONSTRAINT "purchase_problem_note_author_user_id_user_id_fk"
    FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_problem_note_problem_idx"
  ON "purchase_problem_note" ("purchase_problem_id", "created_at");
