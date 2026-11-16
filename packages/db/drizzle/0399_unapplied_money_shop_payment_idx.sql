-- CO-3F7. existsForShopPayment asks whether an "unapplied money received" event already exists for
-- a Shop payment, matching the payload's checkout session OR its payment intent:
--   event_type = 'payment.unapplied_money_received'
--   AND (payload->>'shopCheckoutSessionId' = $1 OR payload->>'stripePaymentIntentId' = $2)
-- It runs inside the payment transaction, under the session's advisory lock. Nothing indexes those
-- keys, so today it walks every unapplied-money event through the 0384 dedupeKey index and reads
-- each JSON payload: the cost grows with every finance task ever opened.
--
-- One partial expression index per key, on the same event type as 0384, so each is one entry per
-- finance task and the OR becomes a BitmapOr of two seeks. The payment-intent index also serves
-- wasEverUnapplied and listOpen's intent filter. Expressions match the reader's
-- payload->>'key' exactly, or the planner will not use them.
--
-- Building it: as 0398. The runner is transactional, so plain CREATE INDEX under a SHARE lock (reads
-- carry on, inserts into domain_events wait; never ACCESS EXCLUSIVE). The predicate keeps the
-- indexes tiny, but the build still reads the whole table once: measured on PG 16 with 1M rows,
-- under 0.1 s each. To build them with no write pause, run before deploying, outside a
-- transaction (psql, autocommit):
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_unapplied_money_session_idx"
--     ON "domain_events" (("payload"->>'shopCheckoutSessionId'))
--     WHERE "event_type" = 'payment.unapplied_money_received';
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_unapplied_money_intent_idx"
--     ON "domain_events" (("payload"->>'stripePaymentIntentId'))
--     WHERE "event_type" = 'payment.unapplied_money_received';
-- then this migration finds them and does nothing. The DO block refuses an INVALID index left by a
-- failed concurrent build. Grants are unchanged (indexes need none).
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
     WHERE c.oid IN (
             to_regclass('public.domain_events_unapplied_money_session_idx'),
             to_regclass('public.domain_events_unapplied_money_intent_idx')
           )
       AND NOT i.indisvalid
  ) THEN
    RAISE EXCEPTION 'an unapplied-money payload index exists but is INVALID (a failed concurrent build); drop it and build it again'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
END
$$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_unapplied_money_session_idx"
  ON "domain_events" (("payload"->>'shopCheckoutSessionId'))
  WHERE "event_type" = 'payment.unapplied_money_received';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_events_unapplied_money_intent_idx"
  ON "domain_events" (("payload"->>'stripePaymentIntentId'))
  WHERE "event_type" = 'payment.unapplied_money_received';
