-- Prevent the same captured payment from being linked to multiple settlement payouts.
-- Apply in staging/prod before enabling settlement at scale (pnpm --filter @auction/db db:migrate).
CREATE UNIQUE INDEX IF NOT EXISTS "payout_line_sale_payment_uidx"
  ON "payout_line" ("payment_id")
  WHERE "kind" = 'sale' AND "payment_id" IS NOT NULL;
