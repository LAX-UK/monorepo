-- How buyers and LAX reach an organisation: a contact email, a phone number and a website, kept
-- by its owners and admins and changed in place on the Profile. One row per organisation; with no
-- row, the organisation has given none yet.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "legal_entity_contact_details" (
  "legal_entity_id" uuid PRIMARY KEY NOT NULL,
  "email" text,
  "phone" text,
  "website" text,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "legal_entity_contact_details_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE cascade,
  CONSTRAINT "legal_entity_contact_details_updated_by_user_id_user_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
