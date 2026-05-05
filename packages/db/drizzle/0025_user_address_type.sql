ALTER TABLE "user_address"
  ADD COLUMN IF NOT EXISTS "address_type" text NOT NULL DEFAULT 'both';
