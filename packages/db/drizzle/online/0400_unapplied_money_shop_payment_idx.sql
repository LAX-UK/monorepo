CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_unapplied_money_session_idx"
  ON "domain_events" (("payload"->>'shopCheckoutSessionId'))
  WHERE "event_type" = 'payment.unapplied_money_received';
--> statement-breakpoint
CREATE INDEX CONCURRENTLY IF NOT EXISTS "domain_events_unapplied_money_intent_idx"
  ON "domain_events" (("payload"->>'stripePaymentIntentId'))
  WHERE "event_type" = 'payment.unapplied_money_received';
