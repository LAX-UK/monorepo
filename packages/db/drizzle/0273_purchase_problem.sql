-- "Report a problem" on a paid purchase: one open report per lot and buying account, worked by
-- the client services team from the staff work inbox.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "purchase_problem" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "payment_id" uuid NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "category" text NOT NULL,
  "message" text NOT NULL,
  "reported_by_user_id" text,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "purchase_problem_status_check" CHECK ("status" IN ('open', 'resolved')),
  CONSTRAINT "purchase_problem_category_check"
    CHECK ("category" IN ('not_as_described', 'damaged', 'not_received', 'invoice_or_payment', 'other')),
  CONSTRAINT "purchase_problem_resolved_check" CHECK (("status" = 'resolved') = ("resolved_at" IS NOT NULL)),
  CONSTRAINT "purchase_problem_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "purchase_problem_buyer_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "purchase_problem_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE restrict,
  CONSTRAINT "purchase_problem_reported_by_user_id_user_id_fk"
    FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_problem_open_uidx"
  ON "purchase_problem" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "purchase_problem_open_created_idx"
  ON "purchase_problem" ("created_at")
  WHERE "status" = 'open';
