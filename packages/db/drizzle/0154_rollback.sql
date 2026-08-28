-- Rollback: subject_id expand (0154_subject_id_expand.sql)
ALTER TABLE public.bid DROP CONSTRAINT IF EXISTS "bid_subject_id_user_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS public."bid_subject_id_created_at_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS public."bid_subject_id_idx";
--> statement-breakpoint
ALTER TABLE public.bid DROP COLUMN IF EXISTS "subject_id";
