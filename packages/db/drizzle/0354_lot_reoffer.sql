-- Re-offering a lot to an underbidder after a buyer default.
--   seller_consent: the seller's answer to a question about their lot, with the terms they saw
--     frozen beside it. Subject-typed so other requests can reuse it; `lot_reoffer` is the first.
--   lot_reoffer: one offer of the defaulted lot to one bidder at that bidder's own bid. A default
--     can lead to several offers, one after another, at most three (`sequence`); only one offer
--     per lot is open at a time. The original hammer and buyer stay on `buyer_default`, whose
--     `offered_user_id` and `offered_amount` are no longer written (no backfill; the columns stay).
--   notification gains the six re-offer notice types.
-- Additive: the running release neither reads nor writes these tables, and keeps working until it
-- restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "seller_consent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" uuid NOT NULL,
  "seller_legal_entity_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "terms_snapshot" jsonb NOT NULL,
  "status" text NOT NULL,
  "channel" text,
  "answered_by_user_id" text,
  "answered_at" timestamp with time zone,
  "note" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "due_at" timestamp with time zone,
  "reminded_at" timestamp with time zone,
  "preferred_next" text,
  CONSTRAINT "seller_consent_subject_type_check" CHECK ("subject_type" IN ('lot_reoffer')),
  CONSTRAINT "seller_consent_status_check"
    CHECK ("status" IN ('requested', 'given', 'refused', 'lapsed', 'not_needed')),
  CONSTRAINT "seller_consent_channel_check"
    CHECK ("channel" IS NULL OR "channel" IN ('workspace', 'recorded_by_staff', 'house_stock')),
  CONSTRAINT "seller_consent_preferred_next_check"
    CHECK ("preferred_next" IS NULL OR ("status" = 'refused' AND "preferred_next" IN ('later_sale', 'return_to_me', 'talk_to_us'))),
  CONSTRAINT "seller_consent_staff_note_check"
    CHECK ("channel" IS DISTINCT FROM 'recorded_by_staff' OR char_length(btrim(coalesce("note", ''))) > 0),
  CONSTRAINT "seller_consent_note_length" CHECK ("note" IS NULL OR char_length("note") <= 1000),
  CONSTRAINT "seller_consent_seller_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("seller_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "seller_consent_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "seller_consent_answered_by_user_id_user_id_fk"
    FOREIGN KEY ("answered_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seller_consent_subject_uidx"
  ON "seller_consent" ("subject_type", "subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_consent_lot_id_idx" ON "seller_consent" ("lot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_consent_seller_idx"
  ON "seller_consent" ("seller_legal_entity_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seller_consent_open_due_idx"
  ON "seller_consent" ("due_at") WHERE "status" = 'requested';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lot_reoffer" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lot_id" uuid NOT NULL,
  "buyer_default_id" uuid NOT NULL,
  "sequence" smallint NOT NULL,
  "offered_user_id" text NOT NULL,
  "offered_legal_entity_id" uuid NOT NULL,
  "source_bid_id" uuid NOT NULL,
  "amount_pence" bigint NOT NULL,
  "status" text NOT NULL,
  "seller_consent_id" uuid NOT NULL,
  "offer_sent_at" timestamp with time zone,
  "offer_ends_at" timestamp with time zone,
  "responded_at" timestamp with time zone,
  "reawarded_at" timestamp with time zone,
  "decline_reason" text,
  "invoice_id" uuid,
  "payment_id" uuid,
  "created_by" text,
  "closed_by" text,
  "close_reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "lot_reoffer_sequence_check" CHECK ("sequence" BETWEEN 1 AND 3),
  CONSTRAINT "lot_reoffer_amount_check" CHECK ("amount_pence" > 0),
  CONSTRAINT "lot_reoffer_status_check"
    CHECK ("status" IN ('awaiting_seller', 'ready', 'offered', 'accepted', 'declined', 'expired', 'seller_declined', 'seller_lapsed', 'withdrawn')),
  CONSTRAINT "lot_reoffer_reawarded_check"
    CHECK ("reawarded_at" IS NULL OR ("status" = 'accepted' AND "responded_at" IS NOT NULL)),
  CONSTRAINT "lot_reoffer_text_length"
    CHECK (("decline_reason" IS NULL OR char_length("decline_reason") <= 500) AND ("close_reason" IS NULL OR char_length("close_reason") <= 1000)),
  CONSTRAINT "lot_reoffer_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade,
  CONSTRAINT "lot_reoffer_buyer_default_id_buyer_default_id_fk"
    FOREIGN KEY ("buyer_default_id") REFERENCES "public"."buyer_default"("id") ON DELETE cascade,
  CONSTRAINT "lot_reoffer_offered_user_id_user_id_fk"
    FOREIGN KEY ("offered_user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "lot_reoffer_offered_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("offered_legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "lot_reoffer_source_bid_id_bid_id_fk"
    FOREIGN KEY ("source_bid_id") REFERENCES "public"."bid"("id") ON DELETE cascade,
  CONSTRAINT "lot_reoffer_seller_consent_id_seller_consent_id_fk"
    FOREIGN KEY ("seller_consent_id") REFERENCES "public"."seller_consent"("id") ON DELETE restrict,
  CONSTRAINT "lot_reoffer_invoice_id_bid_invoice_id_fk"
    FOREIGN KEY ("invoice_id") REFERENCES "public"."bid_invoice"("id") ON DELETE set null,
  CONSTRAINT "lot_reoffer_payment_id_payment_id_fk"
    FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE set null,
  CONSTRAINT "lot_reoffer_created_by_user_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "lot_reoffer_closed_by_user_id_fk"
    FOREIGN KEY ("closed_by") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lot_reoffer_one_open_per_lot_uidx"
  ON "lot_reoffer" ("lot_id") WHERE "status" IN ('awaiting_seller', 'ready', 'offered');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lot_reoffer_default_sequence_uidx"
  ON "lot_reoffer" ("buyer_default_id", "sequence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_reoffer_lot_id_idx" ON "lot_reoffer" ("lot_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_reoffer_seller_consent_idx" ON "lot_reoffer" ("seller_consent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_reoffer_offered_user_idx" ON "lot_reoffer" ("offered_user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lot_reoffer_offered_ends_idx"
  ON "lot_reoffer" ("offer_ends_at") WHERE "status" = 'offered';
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
      'bid_refused_limit',
      'access_requested',
      'access_request_decided',
      'consignment_message',
      'watchlist_reminder',
      'kyc_approved',
      'kyc_declined',
      'sale_cancelled',
      'payment_reminder',
      'buyer_default_notice',
      'sale_announced',
      'artist_lots_listed',
      'search_lots_listed',
      'reoffer_seller_request',
      'reoffer_seller_reminder',
      'reoffer_seller_outcome',
      'reoffer_offer',
      'reoffer_offer_reminder',
      'reoffer_offer_closed'
    )
  );
