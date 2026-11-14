-- An original sold directly in LAX Shop is invoiced by Zoho Books (plan v2, PR 11 part B, flow
-- 22; decision F17: Books issues every Shop invoice). Applies after 0387. Only a Shop switch aimed
-- at Books `live` takes the Books path: in dry run and the test organisation the buyer keeps their
-- Stripe Invoice, exactly as with Books off.
--
-- 1. `invoice_issuer`: who issues the sale's invoice, fixed when staff issue it. `stripe` (every
--    sale until now, and every sale while the Shop switch does not aim at Books live) keeps its
--    Stripe Invoice; `books` is paid through a single-use Stripe Payment Link and invoiced by Books.
-- 2. `paid_at`: when Stripe took the payment.
-- 3. `invoice_number`: the `LAX-INV-` number a `books` sale is invoiced under. The trigger takes the
--    next number from `shop_invoice_counter`, the gap-free counter Shop orders use, in the same
--    transaction that sets `paid_at`, so a payment that rolls back gives its number back and an
--    order and an original can never share one. A `stripe` sale never takes one: its invoice is
--    Stripe's, numbered there.
-- 4. `stripe_payment_link_id`: the Payment Link the buyer of a `books` sale pays through. The
--    paid webhook must name it.
-- 5. `stripe_checkout_session_id`, `stripe_payment_intent_id`: the payment that paid a `books`
--    sale, stored with it. Only that session is a replay; any other paid session for the sale is
--    money for finance. Each is unique: one payment pays one sale.
-- 6. `invoice_recipient_email`, `invoice_recipient_name`: who staff confirmed the invoice goes to,
--    when they issued it. Books' contact and the invoice email use them.
-- 7. `accounting_stripe_shop_original_sale(text)`: which original sale, if any, holds a Stripe
--    PaymentIntent, so the Stripe balance job can attribute its charge to the Shop. The worker may
--    not read the column; this definer function answers that one question and nothing else.
--
-- Grants (db:roles): worker_app reads the sale's columns the books need (recipient included, never
-- a Stripe id) and executes the function. Nothing else is widened.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "shop_original_sale"
  ADD COLUMN IF NOT EXISTS "invoice_issuer" text DEFAULT 'stripe' NOT NULL,
  ADD COLUMN IF NOT EXISTS "paid_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "invoice_number" text,
  ADD COLUMN IF NOT EXISTS "stripe_payment_link_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" text,
  ADD COLUMN IF NOT EXISTS "invoice_recipient_email" text,
  ADD COLUMN IF NOT EXISTS "invoice_recipient_name" text;
--> statement-breakpoint
ALTER TABLE "shop_original_sale" DROP CONSTRAINT IF EXISTS "shop_original_sale_invoice_issuer_chk";
--> statement-breakpoint
ALTER TABLE "shop_original_sale" ADD CONSTRAINT "shop_original_sale_invoice_issuer_chk"
  CHECK ("invoice_issuer" IN ('stripe', 'books'));
--> statement-breakpoint
ALTER TABLE "shop_original_sale" DROP CONSTRAINT IF EXISTS "shop_original_sale_invoice_number_chk";
--> statement-breakpoint
ALTER TABLE "shop_original_sale" ADD CONSTRAINT "shop_original_sale_invoice_number_chk"
  CHECK (
    "invoice_number" IS NULL
    OR ("invoice_issuer" = 'books' AND "paid_at" IS NOT NULL AND "invoice_number" ~ '^LAX-INV-[0-9]+$')
  );
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_original_sale_invoice_number_uid"
  ON "shop_original_sale" USING btree ("invoice_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_original_sale_payment_link_uid"
  ON "shop_original_sale" USING btree ("stripe_payment_link_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_original_sale_checkout_session_uid"
  ON "shop_original_sale" USING btree ("stripe_checkout_session_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shop_original_sale_payment_intent_uid"
  ON "shop_original_sale" USING btree ("stripe_payment_intent_id");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "shop_original_sale_assign_invoice_number"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  next_number integer;
BEGIN
  IF NEW."invoice_issuer" = 'books' AND NEW."paid_at" IS NOT NULL AND NEW."invoice_number" IS NULL THEN
    -- The row lock on the counter queues concurrent payments; a rollback returns the number.
    UPDATE "shop_invoice_counter" SET "last_number" = "last_number" + 1 WHERE "id" = 1
    RETURNING "last_number" INTO next_number;
    IF next_number IS NULL THEN
      RAISE EXCEPTION 'shop_invoice_counter has no row';
    END IF;
    NEW."invoice_number" := 'LAX-INV-' || lpad(next_number::text, 6, '0');
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "shop_original_sale_invoice_number_trg" ON "shop_original_sale";
--> statement-breakpoint
CREATE TRIGGER "shop_original_sale_invoice_number_trg"
BEFORE INSERT OR UPDATE OF "paid_at" ON "shop_original_sale"
FOR EACH ROW EXECUTE FUNCTION "shop_original_sale_assign_invoice_number"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "accounting_stripe_shop_original_sale"(p_payment_intent text) RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $fn$
  SELECT s."id" FROM public."shop_original_sale" s WHERE s."stripe_payment_intent_id" = p_payment_intent
   ORDER BY s."id" LIMIT 1;
$fn$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public."accounting_stripe_shop_original_sale"(text) FROM PUBLIC;
