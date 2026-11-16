-- Notice delivery preferences for identity checks, and in-app notices for registrations to bid.
--   notification_preference gains identity_in_app (the notice for the result of an identity check;
--     its email is transactional and always sent) and registration_in_app (a decision on a request
--     to bid, and a change to its limit), both on by default, so nobody's delivery changes until
--     they choose.
--   notification gains the sale_registration_decided and bidding_limit_changed types: the emails
--     for both already exist, and each now has its notice in the app.
--   notification gains dedupe_key, unique when set: a registration or limit notice is written
--     with the same key as its email, so a projector retry (or a retry part-way through an
--     organisation's members) writes no second notice.
--   Existing opt-outs carry over to the app. Until this release the app notice for artist and
--     saved-search alerts came with the email, so a person who turned that email off (or stopped
--     Bid alerts altogether) got no notice, whatever artist_alerts_in_app / search_alerts_in_app
--     held (default true, never shown while the email was off). Those switches now stand on their
--     own, so they are set off for exactly those people, and a person with no preference row gets
--     one with the switch off. Nobody starts getting a notice they had turned off.
-- Additive: the running release keeps working until it restarts.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "identity_in_app" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_preference"
  ADD COLUMN IF NOT EXISTS "registration_in_app" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "dedupe_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_dedupe_key_uid"
  ON "notification" ("dedupe_key") WHERE "dedupe_key" IS NOT NULL;
--> statement-breakpoint
WITH topic_state AS (
  SELECT x.user_id,
         x.status,
         t_a.email_on AS artists_email,
         t_s.email_on AS searches_email
  FROM "bid_alert_subscriber" x
  JOIN "user" u ON u.id = x.user_id
  LEFT JOIN "bid_alert_topic" t_a ON t_a.subscriber_id = x.id AND t_a.topic = 'bid.artists'
  LEFT JOIN "bid_alert_topic" t_s ON t_s.subscriber_id = x.id AND t_s.topic = 'bid.searches'
),
opted_out AS (
  -- Off for a topic: the person stopped Bid alerts or turned that email off, and no confirmed
  -- address of theirs still had it on (that one delivered the notice, so it stays on).
  SELECT user_id,
         bool_or(status = 'stopped' OR artists_email IS FALSE)
           AND NOT bool_or(status = 'confirmed' AND artists_email IS TRUE) AS artists_off,
         bool_or(status = 'stopped' OR searches_email IS FALSE)
           AND NOT bool_or(status = 'confirmed' AND searches_email IS TRUE) AS searches_off
  FROM topic_state
  GROUP BY user_id
)
INSERT INTO "notification_preference" ("user_id", "artist_alerts_in_app", "search_alerts_in_app")
SELECT o.user_id, NOT o.artists_off, NOT o.searches_off
FROM opted_out o
WHERE o.artists_off OR o.searches_off
ON CONFLICT ("user_id") DO UPDATE SET
  "artist_alerts_in_app" = "notification_preference"."artist_alerts_in_app"
    AND EXCLUDED."artist_alerts_in_app",
  "search_alerts_in_app" = "notification_preference"."search_alerts_in_app"
    AND EXCLUDED."search_alerts_in_app";
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
      'bidding_limit_changed'
    )
  ) NOT VALID;
