-- Fulfilment of numbered prints: who approved selling a hors commerce proof, the artist's written
-- authority behind certificates London Art Exchange Ltd issues, and what each certificate row
-- needs to be traced back to a confirmed print. Additive only.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD COLUMN IF NOT EXISTS "hors_commerce_approved_by_subject_id" text,
  ADD COLUMN IF NOT EXISTS "hors_commerce_approved_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_artwork"
  ADD CONSTRAINT "shop_artwork_hors_commerce_approval_ck" CHECK (
    ("hors_commerce_approved_by_subject_id" IS NULL) = ("hors_commerce_approved_at" IS NULL)
    AND ("hors_commerce_approved_at" IS NULL OR "proof_type" = 'hc')
  );
--> statement-breakpoint
ALTER TABLE "shop_edition_facts"
  ADD COLUMN IF NOT EXISTS "certificate_authority_reference" text,
  ADD COLUMN IF NOT EXISTS "certificate_authority_recorded_by" text,
  ADD COLUMN IF NOT EXISTS "certificate_authority_recorded_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "shop_edition_facts"
  ADD CONSTRAINT "shop_edition_facts_certificate_authority_ck" CHECK (
    (("certificate_authority_reference" IS NULL) = ("certificate_authority_recorded_by" IS NULL))
    AND (("certificate_authority_reference" IS NULL) = ("certificate_authority_recorded_at" IS NULL))
    AND ("certificate_authority_reference" IS NULL
      OR length(btrim("certificate_authority_reference")) > 0)
  );
--> statement-breakpoint
ALTER TABLE "shop_certificate"
  ADD COLUMN IF NOT EXISTS "print_label" text,
  ADD COLUMN IF NOT EXISTS "authority_reference" text,
  ADD COLUMN IF NOT EXISTS "issued_by_subject_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_certificate_pending_idx"
  ON "shop_certificate" ("created_at") WHERE "issued_at" IS NULL;
--> statement-breakpoint
ALTER TABLE "shop_order_line"
  ADD CONSTRAINT "shop_order_line_pack_confirmed_ck" CHECK (
    ("pack_confirmed_at" IS NULL) = ("pack_confirmed_by" IS NULL)
  );
