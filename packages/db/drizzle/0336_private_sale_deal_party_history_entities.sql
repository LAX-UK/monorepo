-- A party to a private sale deal can be an organisation with no named person acting for it yet.
-- The party history kept only namings that had a person, so an organisation named on its own was
-- missing from it, and so from every rule that asks who was ever named on a deal. A naming now
-- needs a person or an organisation (or both), and an organisation named on its own is kept once
-- per deal and side.
-- Additive: a column becomes nullable, a check and an index are added, and the organisations
-- already on deals without a person are copied in.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "private_sale_deal_party_history" ALTER COLUMN "acting_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "private_sale_deal_party_history"
  ADD CONSTRAINT "private_sale_deal_party_history_who_check"
  CHECK ("acting_user_id" IS NOT NULL OR "legal_entity_id" IS NOT NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "private_sale_deal_party_history" VALIDATE CONSTRAINT "private_sale_deal_party_history_who_check";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_party_history_entity_uidx"
  ON "private_sale_deal_party_history" ("deal_id", "role", "legal_entity_id")
  WHERE "acting_user_id" IS NULL AND "legal_entity_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_party_history_entity_idx"
  ON "private_sale_deal_party_history" ("legal_entity_id");
--> statement-breakpoint
INSERT INTO "private_sale_deal_party_history" ("deal_id", "role", "legal_entity_id", "acting_user_id", "named_at")
SELECT p."deal_id", p."role", p."legal_entity_id", NULL, p."created_at"
FROM "private_sale_deal_party" p
WHERE p."acting_user_id" IS NULL
ON CONFLICT DO NOTHING;
