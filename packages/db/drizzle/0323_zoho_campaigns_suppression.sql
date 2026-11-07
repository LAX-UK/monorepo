-- Zoho Campaigns unsubscribes and hard bounces recorded in LAX's own suppression list.
--   email_suppression.source                          where an entry came from (null = Postmark or LAX).
--   email_suppression_reason_check                    adds 'unsubscribed_marketing', a marketing and
--                                                     alert opt-out that never blocks other mail.
--   zoho_campaigns_suppression_state                  the newest event already read, one row per mode.
--   zoho_campaigns_optout_lift                        when a person last asked for mail again, per
--                                                     address hash; the sync skips opt-outs up to then.
--   lift_zoho_campaigns_opt_out()                     the only way a lift is written: records it and
--                                                     removes the Campaigns marketing opt-out, nothing else.
-- Additive: the running release neither reads the new column or table nor writes the new reason.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "email_suppression" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_reason_check";
--> statement-breakpoint
ALTER TABLE "email_suppression"
  ADD CONSTRAINT "email_suppression_reason_check" CHECK (
    "reason" IN (
      'hard_bounce', 'complaint', 'manual', 'unsubscribe', 'soft_bounce_threshold',
      'unsubscribed_marketing'
    )
  );
--> statement-breakpoint
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_source_check";
--> statement-breakpoint
ALTER TABLE "email_suppression"
  ADD CONSTRAINT "email_suppression_source_check" CHECK ("source" IS NULL OR "source" IN ('zoho_campaigns'));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_campaigns_suppression_state" (
  "mode" text PRIMARY KEY NOT NULL,
  "watermark" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zoho_campaigns_suppression_state_mode_check" CHECK ("mode" IN ('dry_run', 'live'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zoho_campaigns_optout_lift" (
  "email_hash" text PRIMARY KEY NOT NULL,
  "lifted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- One function writes a lift, so every path (Bid, Shop, lax.art, the sync, the newsletter) lifts the
-- same way and no application role needs DELETE on email_suppression. It deletes only a marketing
-- opt-out that came from Zoho Campaigns: bounces, complaints and manual blocks are never touched.
-- p_only_if_older (the re-subscribe path) lifts only when such an opt-out exists and predates
-- p_lifted_at; without it the lift is recorded even if there is no entry yet, so an old unsubscribe
-- that reaches the list later is skipped. Returns true when an entry was removed.
CREATE OR REPLACE FUNCTION public.lift_zoho_campaigns_opt_out(
  p_email_hash text, p_lifted_at timestamptz, p_only_if_older boolean DEFAULT false
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  removed integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_email_hash));
  IF p_only_if_older AND NOT EXISTS (
    SELECT 1 FROM public."email_suppression"
    WHERE "email_hash" = p_email_hash
      AND "reason" = 'unsubscribed_marketing' AND "source" = 'zoho_campaigns'
      AND "created_at" < p_lifted_at
  ) THEN
    RETURN false;
  END IF;
  INSERT INTO public."zoho_campaigns_optout_lift" ("email_hash", "lifted_at")
  VALUES (p_email_hash, p_lifted_at)
  ON CONFLICT ("email_hash") DO UPDATE
    SET "lifted_at" = GREATEST(public."zoho_campaigns_optout_lift"."lifted_at", EXCLUDED."lifted_at");
  DELETE FROM public."email_suppression"
  WHERE "email_hash" = p_email_hash
    AND "reason" = 'unsubscribed_marketing' AND "source" = 'zoho_campaigns';
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed > 0;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.lift_zoho_campaigns_opt_out(text, timestamptz, boolean) FROM PUBLIC;
