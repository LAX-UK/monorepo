-- Everyone who was ever named on a private sale deal. The party table holds only the current
-- buyer, so replacing the buyer lost who had been named before. Compliance checks opened for a
-- replaced buyer still belong to the deal's record, so each naming is kept here, written in the
-- same transaction as the party and never changed. `acting_user_id` has no foreign key on purpose:
-- deleting an account must not erase who was named on a deal whose record is being kept.
-- Additive: one new table. Existing namings are copied in from the current parties and from the
-- party-named events that carry a person.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_party_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL REFERENCES "private_sale_deal" ("id") ON DELETE RESTRICT,
  "role" text NOT NULL,
  "legal_entity_id" uuid REFERENCES "legal_entity" ("id") ON DELETE RESTRICT,
  "acting_user_id" text NOT NULL,
  "named_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_party_history_role_check" CHECK ("role" IN ('seller', 'buyer'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "private_sale_deal_party_history_naming_uidx"
  ON "private_sale_deal_party_history" ("deal_id", "role", "acting_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_party_history_user_idx"
  ON "private_sale_deal_party_history" ("acting_user_id");
--> statement-breakpoint
INSERT INTO "private_sale_deal_party_history" ("deal_id", "role", "legal_entity_id", "acting_user_id", "named_at")
SELECT p."deal_id", p."role", p."legal_entity_id", p."acting_user_id", p."created_at"
FROM "private_sale_deal_party" p
WHERE p."acting_user_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "private_sale_deal_party_history" ("deal_id", "role", "legal_entity_id", "acting_user_id", "named_at")
SELECT d."id", e."payload"->>'role', NULL, e."payload"->>'actingUserId', e."occurred_at"
FROM "domain_events" e
JOIN "private_sale_deal" d ON d."id"::text = e."aggregate_id"
WHERE e."aggregate_type" = 'private_sale_deal'
  AND e."event_type" = 'private_sale_deal.party_named'
  AND e."payload"->>'actingUserId' IS NOT NULL
  AND e."payload"->>'role' IN ('seller', 'buyer')
ON CONFLICT DO NOTHING;
