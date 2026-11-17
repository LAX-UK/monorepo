-- Bid admin Deliveries, part 3: staff decline a delivery quote ("Can't deliver"), design
-- docs/design/staff-gaps-delivery-zoho-alerts.md D8.
--   delivery_quote gains decline_reason: why the team turned the request down, as the buyer is
--     told it. Set only when staff decline (the quote ends as withdrawn, the buyer may ask again);
--     a buyer's own withdrawal leaves it empty, which is how the two are told apart.
--   notification gains the delivery_quote_declined type: the buyer's notice and email.
-- Additive: the new column is nullable with no default, so no row is rewritten and the running
-- release (which neither reads nor writes it) keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "delivery_quote" ADD COLUMN IF NOT EXISTS "decline_reason" text;
--> statement-breakpoint
-- Every existing row has no reason yet, so the check holds for all of them. It is added NOT VALID
-- and then validated, but the whole migration runs in one transaction, so the ACCESS EXCLUSIVE
-- lock from ADD CONSTRAINT is held through the VALIDATE scan: the split saves no lock time. That
-- is acceptable because delivery_quote holds one row per delivery a buyer asked for, so the scan
-- is short. If the table ever grows, validate in a later migration instead.
ALTER TABLE "delivery_quote" DROP CONSTRAINT IF EXISTS "delivery_quote_decline_reason_check";
--> statement-breakpoint
ALTER TABLE "delivery_quote"
  ADD CONSTRAINT "delivery_quote_decline_reason_check" CHECK (
    "decline_reason" IS NULL OR (
      "status" = 'withdrawn'
      AND char_length("decline_reason") BETWEEN 1 AND 500
      AND "decline_reason" = btrim("decline_reason")
    )
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "delivery_quote" VALIDATE CONSTRAINT "delivery_quote_decline_reason_check";
--> statement-breakpoint
-- The rebuilt check allows every type the previous one did, and that one already held for every
-- row, so it is added NOT VALID: no scan of notification while the table is locked.
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
      'reoffer_offer_closed',
      'collection_booked',
      'collection_changed',
      'collection_cancelled',
      'collection_reminder',
      'sale_registration_decided',
      'bidding_limit_changed',
      'delivery_quote_declined'
    )
  ) NOT VALID;
