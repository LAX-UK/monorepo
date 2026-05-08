-- payout PDF statements (Spaces object URL + generation error audit)
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "statement_url" text;
ALTER TABLE "payout" ADD COLUMN IF NOT EXISTS "statement_generation_error" text;
