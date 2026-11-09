-- Rollback for 0332_shop_framing_price_trigger_lock: puts back the 0331 trigger function, which
-- reads the option's status without locking it. Safe at any time; no data changes.
BEGIN;

SET LOCAL lock_timeout = '5s';
CREATE OR REPLACE FUNCTION "shop_framing_no_placeholder_offer"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'shop_framing_option' THEN
    IF NEW."status" = 'active' AND EXISTS (
      SELECT 1 FROM "shop_framing_option_price" p
      WHERE p."option_id" = NEW."id" AND p."is_placeholder"
    ) THEN
      RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % cannot be offered while a price is a placeholder', NEW."id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
    END IF;
  ELSIF NEW."is_placeholder" AND EXISTS (
    SELECT 1 FROM "shop_framing_option" o WHERE o."id" = NEW."option_id" AND o."status" = 'active'
  ) THEN
    RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % is offered, so a price cannot become a placeholder', NEW."option_id"
      USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
