-- Phase 6: expand immutable subject_id on high-traffic Bid tables (FK removal prep).
ALTER TABLE public.bid
  ADD COLUMN IF NOT EXISTS "subject_id" text;
--> statement-breakpoint
UPDATE public.bid
SET "subject_id" = "bidder_id"
WHERE "subject_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_subject_id_idx"
  ON public.bid ("subject_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bid_subject_id_created_at_idx"
  ON public.bid ("subject_id", "created_at");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bid_subject_id_user_fk'
  ) THEN
    ALTER TABLE public.bid
      ADD CONSTRAINT "bid_subject_id_user_fk"
      FOREIGN KEY ("subject_id") REFERENCES public."user"("id")
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;
