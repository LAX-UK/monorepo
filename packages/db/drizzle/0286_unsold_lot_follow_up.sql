-- The staff work a confirmed unsold-lot choice leaves behind: relist with the agreed reserve,
-- arrange the return, or follow up a private sale. One row per confirmed choice.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "unsold_lot_follow_up" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "choice_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "lot_end_time" timestamp with time zone NOT NULL,
  "submission_id" uuid NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "reserve" numeric(18, 2),
  "status" text DEFAULT 'open' NOT NULL,
  "reserve_applied_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "completed_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unsold_lot_follow_up_kind_check" CHECK ("kind" IN ('relist', 'collect', 'private_sale')),
  CONSTRAINT "unsold_lot_follow_up_status_check" CHECK ("status" IN ('open', 'done')),
  CONSTRAINT "unsold_lot_follow_up_reserve_check" CHECK ("reserve_applied_at" IS NULL OR "kind" = 'relist')
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_follow_up" ADD CONSTRAINT "unsold_lot_follow_up_choice_id_unsold_lot_choice_id_fk" FOREIGN KEY ("choice_id") REFERENCES "public"."unsold_lot_choice"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_follow_up" ADD CONSTRAINT "unsold_lot_follow_up_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_follow_up" ADD CONSTRAINT "unsold_lot_follow_up_submission_id_item_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."item_submission"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_follow_up" ADD CONSTRAINT "unsold_lot_follow_up_legal_entity_id_legal_entity_id_fk" FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "unsold_lot_follow_up" ADD CONSTRAINT "unsold_lot_follow_up_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unsold_lot_follow_up_choice_uidx" ON "unsold_lot_follow_up" ("choice_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_follow_up_lot_idx" ON "unsold_lot_follow_up" ("lot_id", "lot_end_time");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_follow_up_submission_idx" ON "unsold_lot_follow_up" ("submission_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unsold_lot_follow_up_open_idx" ON "unsold_lot_follow_up" ("created_at") WHERE "status" = 'open';
--> statement-breakpoint
-- Choices confirmed before this release get their work too, so none is forgotten. A lot already
-- back in inventory or sold again since is left alone: only the latest outcome is followed up.
INSERT INTO "unsold_lot_follow_up"
  ("choice_id", "lot_id", "lot_end_time", "submission_id", "legal_entity_id", "kind", "reserve")
SELECT c."id", c."lot_id", c."lot_end_time", c."submission_id", c."legal_entity_id",
       c."decided_choice",
       CASE WHEN c."decided_choice" = 'relist' THEN c."decided_reserve" END
FROM "unsold_lot_choice" AS c
JOIN "lot" AS l ON l."id" = c."lot_id" AND l."end_time" = c."lot_end_time"
WHERE c."status" = 'confirmed'
  AND c."decided_choice" IS NOT NULL
  AND l."status" IN ('ended', 'voided')
  AND l."winner_id" IS NULL
ON CONFLICT DO NOTHING;
