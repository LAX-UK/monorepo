CREATE UNIQUE INDEX IF NOT EXISTS "shop_sale_authority_grant_request_uid"
  ON "shop_sale_authority_grant" ("request_id")
  WHERE "request_id" IS NOT NULL;
