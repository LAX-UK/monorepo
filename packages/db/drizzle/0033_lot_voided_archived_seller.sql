-- voided lot outcome + seller-archived catalog flag (PG 15+: IF NOT EXISTS)
ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'voided';

ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "voided_reason" text;
ALTER TABLE "lot" ADD COLUMN IF NOT EXISTS "archived_seller" boolean NOT NULL DEFAULT false;
