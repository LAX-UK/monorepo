-- Drops the remembered account; Bid then opens in the personal account on a new device, so roll
-- back the application release first.
ALTER TABLE "bid_user_profile" DROP CONSTRAINT IF EXISTS "bid_user_profile_last_acting_legal_entity_id_legal_entity_id_fk";

ALTER TABLE "bid_user_profile" DROP COLUMN IF EXISTS "last_acting_legal_entity_id";
