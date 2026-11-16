-- Rollback for 0399_notice_delivery_preferences. Roll the release back first: the previous release
-- neither writes nor reads these notices or switches. Registration and limit notices already
-- delivered are deleted, since the previous constraint does not allow their types; the emails for
-- them are not affected. The two preference columns and notification.dedupe_key are dropped, and the constraint is restored
-- to the 0392 list. The artist and saved-search app switches the forward step turned off for people
-- whose email for that topic is off (or whose Bid alerts are stopped) go back on: the previous
-- release shows them locked off and reads them only once the email is on again, as before 0399.
-- Preference rows the forward step created hold only defaults then, and are kept. Also removes
-- this migration's ledger row so a later deploy reapplies it.
BEGIN;

SET LOCAL lock_timeout = '30s';

DELETE FROM notification WHERE type IN ('sale_registration_decided', 'bidding_limit_changed');

WITH topic_state AS (
  SELECT x.user_id,
         x.status,
         t_a.email_on AS artists_email,
         t_s.email_on AS searches_email
  FROM "bid_alert_subscriber" x
  LEFT JOIN "bid_alert_topic" t_a ON t_a.subscriber_id = x.id AND t_a.topic = 'bid.artists'
  LEFT JOIN "bid_alert_topic" t_s ON t_s.subscriber_id = x.id AND t_s.topic = 'bid.searches'
  WHERE x.user_id IS NOT NULL
),
opted_out AS (
  SELECT user_id,
         bool_or(status = 'stopped' OR artists_email IS FALSE)
           AND NOT bool_or(status = 'confirmed' AND artists_email IS TRUE) AS artists_off,
         bool_or(status = 'stopped' OR searches_email IS FALSE)
           AND NOT bool_or(status = 'confirmed' AND searches_email IS TRUE) AS searches_off
  FROM topic_state
  GROUP BY user_id
)
UPDATE "notification_preference" p
SET "artist_alerts_in_app" = p."artist_alerts_in_app" OR o.artists_off,
    "search_alerts_in_app" = p."search_alerts_in_app" OR o.searches_off
FROM opted_out o
WHERE o.user_id = p.user_id AND (o.artists_off OR o.searches_off);

DROP INDEX IF EXISTS "notification_dedupe_key_uid";
ALTER TABLE "notification" DROP COLUMN IF EXISTS "dedupe_key";

ALTER TABLE "notification_preference" DROP COLUMN IF EXISTS "identity_in_app";
ALTER TABLE "notification_preference" DROP COLUMN IF EXISTS "registration_in_app";

ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check;

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
      'collection_reminder'
    )
  );

DELETE FROM drizzle.__drizzle_migrations WHERE created_at = 1812715200000;

COMMIT;
