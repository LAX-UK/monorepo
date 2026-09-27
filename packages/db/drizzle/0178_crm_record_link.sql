CREATE TABLE IF NOT EXISTS "crm_record_link" (
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "zoho_module" text NOT NULL,
  "zoho_record_id" text NOT NULL,
  "erased_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "crm_record_link_pkey" PRIMARY KEY ("entity_type", "entity_id")
);

CREATE INDEX IF NOT EXISTS "crm_record_link_zoho_module_record_idx"
  ON "crm_record_link" ("zoho_module", "zoho_record_id");

CREATE INDEX IF NOT EXISTS "crm_record_link_erased_at_idx"
  ON "crm_record_link" ("erased_at")
  WHERE "erased_at" IS NOT NULL;
