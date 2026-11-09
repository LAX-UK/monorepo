-- A price becoming a placeholder reads the option's status; the option going live reads the
-- prices. Run together, each could pass its check and leave an offered option with a placeholder
-- price. The price trigger now takes the option row's lock, whatever its status, before it reads
-- the status, so the two changes happen one after the other. The option's own update already holds
-- that row's lock, so whichever comes second waits and then sees the first. Read committed
-- re-reads the row once the lock is given, which the check relies on. The rest of the function is
-- unchanged from 0331.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "shop_framing_no_placeholder_offer"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status text;
BEGIN
  IF TG_TABLE_NAME = 'shop_framing_option' THEN
    IF NEW."status" = 'active' AND EXISTS (
      SELECT 1 FROM "shop_framing_option_price" p
      WHERE p."option_id" = NEW."id" AND p."is_placeholder"
    ) THEN
      RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % cannot be offered while a price is a placeholder', NEW."id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
    END IF;
  ELSIF NEW."is_placeholder" THEN
    SELECT o."status" INTO v_status FROM "shop_framing_option" o WHERE o."id" = NEW."option_id" FOR UPDATE;
    IF v_status = 'active' THEN
      RAISE EXCEPTION 'shop_framing_option_placeholder_not_offered_ck: framing option % is offered, so a price cannot become a placeholder', NEW."option_id"
        USING ERRCODE = 'check_violation', CONSTRAINT = 'shop_framing_option_placeholder_not_offered_ck';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
