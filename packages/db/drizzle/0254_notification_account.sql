-- Notifications belong to an account. Each notification records the legal entity it is about
-- (a personal or an organisation account), so opening one can switch to that account, the
-- inbox can be filtered by account, and a member can mute an organisation.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "legal_entity_id" uuid;
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_legal_entity_id_legal_entity_id_fk";
--> statement-breakpoint
ALTER TABLE "notification"
  ADD CONSTRAINT "notification_legal_entity_id_legal_entity_id_fk"
  FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE set null;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_user_id_legal_entity_id_created_at_idx"
  ON "notification" USING btree ("user_id", "legal_entity_id", "created_at");
--> statement-breakpoint
-- Backfill where the source record says which account the notification is about. Everything
-- else stays personal (no account), which is what every notification meant until now.
--
-- Bidding notices for a bidder: the account of their latest bid on the lot.
UPDATE "notification" AS n
SET "legal_entity_id" = (
  SELECT b."buyer_legal_entity_id"
  FROM "bid" AS b
  WHERE b."lot_id" = n."lot_id" AND b."bidder_id" = n."user_id"
  ORDER BY b."created_at" DESC
  LIMIT 1
)
WHERE n."legal_entity_id" IS NULL
  AND n."lot_id" IS NOT NULL
  AND n."type" IN ('outbid', 'lot_lost', 'lot_ending_soon', 'lot_cancelled');
--> statement-breakpoint
-- Notices for the buyer of a won lot: the account that won it.
UPDATE "notification" AS n
SET "legal_entity_id" = l."buyer_legal_entity_id"
FROM "lot" AS l
WHERE n."legal_entity_id" IS NULL
  AND l."id" = n."lot_id"
  AND l."winner_id" = n."user_id"
  AND l."buyer_legal_entity_id" IS NOT NULL
  AND n."type" IN (
    'lot_won',
    'payment_due',
    'payment_received',
    'lot_ready_for_collection',
    'lot_shipped',
    'lot_delivered'
  );
--> statement-breakpoint
-- Notices for the seller of a lot: the consigning account.
UPDATE "notification" AS n
SET "legal_entity_id" = l."seller_legal_entity_id"
FROM "lot" AS l
WHERE n."legal_entity_id" IS NULL
  AND l."id" = n."lot_id"
  AND n."type" IN ('lot_ended_seller', 'payment_received', 'consignment_update')
  AND EXISTS (
    SELECT 1 FROM "legal_entity_member" AS m
    WHERE m."legal_entity_id" = l."seller_legal_entity_id" AND m."user_id" = n."user_id"
  );
--> statement-breakpoint
-- Consignment notices: the account that submitted the work.
UPDATE "notification" AS n
SET "legal_entity_id" = s."legal_entity_id"
FROM "item_submission" AS s
WHERE n."legal_entity_id" IS NULL
  AND s."id" = n."submission_id"
  AND n."type" IN (
    'submission_received_for_review',
    'submission_approved',
    'submission_rejected',
    'submission_converted',
    'submission_draft_reminder',
    'submission_changes_requested',
    'consignment_agreement_reminder',
    'consignment_update',
    'condition_report_ready',
    'condition_report_declined'
  );
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_account_mute" (
  "user_id" text NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_account_mute_user_id_legal_entity_id_pk" PRIMARY KEY ("user_id", "legal_entity_id"),
  CONSTRAINT "notification_account_mute_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "notification_account_mute_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notification_account_mute_legal_entity_id_idx"
  ON "notification_account_mute" USING btree ("legal_entity_id");
