SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
DO $$
DECLARE
  dup_pending int;
BEGIN
  SELECT count(*) INTO dup_pending FROM (
    SELECT "artwork_id", "owner_party_id"
    FROM "shop_sale_authority_request"
    WHERE "status" = 'pending'
    GROUP BY "artwork_id", "owner_party_id"
    HAVING count(*) > 1
  ) t;
  IF dup_pending > 0 THEN
    RAISE EXCEPTION '0202_shop_sale_authority_request_pending_uid: % duplicate pending request(s) — resolve before migrating', dup_pending;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_sale_authority_request_pending_uid"
  ON "shop_sale_authority_request" ("artwork_id", "owner_party_id")
  WHERE "status" = 'pending';
