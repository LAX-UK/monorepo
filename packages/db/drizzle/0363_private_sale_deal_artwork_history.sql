-- Each link, change or removal of a private sale deal's artwork is kept: who made it, when, the
-- reason they gave, and the artwork before and after. A new table only: nothing existing changes.
-- Append-only: a trigger refuses changes and deletes, except the actor being cleared when that user
-- is removed (the foreign key's ON DELETE SET NULL).
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
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "private_sale_deal_artwork_history_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW."actor_user_id" IS NULL
     AND OLD."actor_user_id" IS NOT NULL
     AND (NEW."id", NEW."deal_id", NEW."action", NEW."from_artwork_register_id", NEW."to_artwork_register_id",
          NEW."from_unlinked_reason", NEW."to_unlinked_reason", NEW."reason", NEW."created_at")
         IS NOT DISTINCT FROM (OLD."id", OLD."deal_id", OLD."action", OLD."from_artwork_register_id", OLD."to_artwork_register_id",
          OLD."from_unlinked_reason", OLD."to_unlinked_reason", OLD."reason", OLD."created_at")
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'private_sale_deal_artwork_history is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "private_sale_deal_artwork_history_guard" ON "private_sale_deal_artwork_history";
--> statement-breakpoint
CREATE TRIGGER "private_sale_deal_artwork_history_guard"
  BEFORE UPDATE OR DELETE ON "private_sale_deal_artwork_history"
  FOR EACH ROW EXECUTE FUNCTION "private_sale_deal_artwork_history_guard"();
