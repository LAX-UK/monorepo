-- Each link, change or removal of a private sale deal's artwork is kept: who made it, when, the
-- reason they gave, and the artwork before and after. A new table only: nothing existing changes.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "private_sale_deal_artwork_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "deal_id" uuid NOT NULL,
  "action" text NOT NULL,
  "actor_user_id" text,
  "from_artwork_register_id" uuid,
  "to_artwork_register_id" uuid,
  "from_unlinked_reason" text,
  "to_unlinked_reason" text,
  "reason" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "private_sale_deal_artwork_history_action_check" CHECK ("action" IN ('linked', 'changed', 'removed')),
  CONSTRAINT "private_sale_deal_artwork_history_reasons_check" CHECK (("from_unlinked_reason" IS NULL OR "from_unlinked_reason" IN ('sellers_own_work', 'in_zoho_not_linked')) AND ("to_unlinked_reason" IS NULL OR "to_unlinked_reason" IN ('sellers_own_work', 'in_zoho_not_linked'))),
  CONSTRAINT "private_sale_deal_artwork_history_deal_fk" FOREIGN KEY ("deal_id") REFERENCES "private_sale_deal"("id") ON DELETE RESTRICT,
  CONSTRAINT "private_sale_deal_artwork_history_actor_fk" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
  CONSTRAINT "private_sale_deal_artwork_history_from_fk" FOREIGN KEY ("from_artwork_register_id") REFERENCES "artwork_register"("id") ON DELETE RESTRICT,
  CONSTRAINT "private_sale_deal_artwork_history_to_fk" FOREIGN KEY ("to_artwork_register_id") REFERENCES "artwork_register"("id") ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "private_sale_deal_artwork_history_deal_idx" ON "private_sale_deal_artwork_history" ("deal_id", "created_at");
