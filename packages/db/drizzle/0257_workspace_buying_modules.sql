-- The client workspace's buying modules. Buyers can ask for a courier quote on a won lot and
-- accept it once the saleroom team prices it; artists a person follows can carry alert criteria
-- (medium and price range); and three notices join the inbox: a quote is ready, a payout ran into
-- a problem, and a maximum bid stopped at a bidding limit. Nothing changes until someone uses them.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "delivery_quote" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "buyer_legal_entity_id" uuid NOT NULL,
  "status" text NOT NULL,
  "destination" text NOT NULL,
  "amount" numeric(18, 2),
  "currency" text DEFAULT 'GBP' NOT NULL,
  "quote_note" text,
  "requested_by_user_id" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "quoted_by_user_id" text,
  "quoted_at" timestamp with time zone,
  "decided_by_user_id" text,
  "decided_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "delivery_quote_status_check"
    CHECK ("status" IN ('requested', 'quoted', 'accepted', 'withdrawn')),
  CONSTRAINT "delivery_quote_amount_check"
    CHECK (("status" NOT IN ('quoted', 'accepted') OR "amount" IS NOT NULL) AND ("amount" IS NULL OR "amount" > 0)),
  CONSTRAINT "delivery_quote_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "delivery_quote_buyer_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("buyer_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "delivery_quote_requested_by_user_id_user_id_fk"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "delivery_quote_quoted_by_user_id_user_id_fk"
    FOREIGN KEY ("quoted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "delivery_quote_decided_by_user_id_user_id_fk"
    FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "delivery_quote_live_uidx"
  ON "delivery_quote" ("lot_id", "buyer_legal_entity_id")
  WHERE "status" IN ('requested', 'quoted', 'accepted');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_quote_buyer_legal_entity_id_idx"
  ON "delivery_quote" ("buyer_legal_entity_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "delivery_quote_requested_idx"
  ON "delivery_quote" ("requested_at")
  WHERE "status" = 'requested';
--> statement-breakpoint
ALTER TABLE "artist_watchlist" ADD COLUMN IF NOT EXISTS "alert_medium" text;
--> statement-breakpoint
ALTER TABLE "artist_watchlist" ADD COLUMN IF NOT EXISTS "alert_price_min" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "artist_watchlist" ADD COLUMN IF NOT EXISTS "alert_price_max" numeric(18, 2);
--> statement-breakpoint
ALTER TABLE "artist_watchlist" ADD COLUMN IF NOT EXISTS "alert_updated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "artist_watchlist" DROP CONSTRAINT IF EXISTS "artist_watchlist_alert_price_range_check";
--> statement-breakpoint
ALTER TABLE "artist_watchlist"
  ADD CONSTRAINT "artist_watchlist_alert_price_range_check" CHECK (
    ("alert_price_min" IS NULL OR "alert_price_min" >= 0)
    AND ("alert_price_max" IS NULL OR "alert_price_max" >= 0)
    AND ("alert_price_min" IS NULL OR "alert_price_max" IS NULL OR "alert_price_min" <= "alert_price_max")
  );
--> statement-breakpoint
ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;
--> statement-breakpoint
ALTER TABLE notification
  ADD CONSTRAINT notification_type_check CHECK (
    type IN (
      'outbid',
      'lot_cancelled',
      'lot_won',
      'lot_lost',
      'lot_ending_soon',
      'watchlist_starting',
      'watchlist_ending_soon',
      'payment_received',
      'payment_due',
      'lot_ended_seller',
      'kyc_resubmission_required',
      'submission_received_for_review',
      'submission_approved',
      'submission_rejected',
      'submission_converted',
      'submission_draft_reminder',
      'submission_changes_requested',
      'consignment_agreement_reminder',
      'consignment_update',
      'condition_report_ready',
      'condition_report_declined',
      'source_of_funds_documents_requested',
      'source_of_funds_approved',
      'source_of_funds_rejected',
      'staff_role_expired',
      'staff_role_expired_admin',
      'staff_role_changed',
      'staff_role_changed_admin',
      'lot_ready_for_collection',
      'lot_shipped',
      'lot_delivered',
      'organisation_member_left',
      'payout_bank_changed',
      'delivery_quote_ready',
      'payout_problem',
      'bid_refused_limit'
    )
  );
