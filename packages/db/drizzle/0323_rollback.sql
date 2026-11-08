-- Rollback for 0323_zoho_campaigns_suppression. Roll back the application release first: the
-- previous release does not know the new reason. Marketing opt-outs become plain 'unsubscribe'
-- (which silences optional mail only), so no one who opted out is mailed again. The sync
-- watermark and the lift record are lost; if the release is deployed again, the sync re-reads
-- Campaigns and silences, until they confirm again, anyone who had lifted an older opt-out.
BEGIN;

SET LOCAL lock_timeout = '30s';

DROP FUNCTION IF EXISTS public.lift_zoho_campaigns_opt_out(text, timestamptz, boolean);
DROP TABLE IF EXISTS "zoho_campaigns_optout_lift";
DROP TABLE IF EXISTS "zoho_campaigns_suppression_state";

UPDATE "email_suppression" SET "reason" = 'unsubscribe' WHERE "reason" = 'unsubscribed_marketing';
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_source_check";
ALTER TABLE "email_suppression" DROP CONSTRAINT IF EXISTS "email_suppression_reason_check";
ALTER TABLE "email_suppression"
  ADD CONSTRAINT "email_suppression_reason_check" CHECK (
    "reason" IN ('hard_bounce', 'complaint', 'manual', 'unsubscribe', 'soft_bounce_threshold')
  );
ALTER TABLE "email_suppression" DROP COLUMN IF EXISTS "source";

COMMIT;
