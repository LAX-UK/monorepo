-- Per-platform staff grants on invitations + Shop inbox for lax.staff_access.* events (see D36).
-- One invitation may grant a role on several LAX platforms; Bid applies its grant when the
-- invite is accepted and emits lax.staff_access.granted for every other platform.
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_invitation_product_grant" (
  "invitation_id" uuid NOT NULL REFERENCES "user_invitation"("id") ON DELETE CASCADE,
  "product" text NOT NULL,
  "role" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_invitation_product_grant_pk" PRIMARY KEY ("invitation_id", "product"),
  CONSTRAINT "user_invitation_product_grant_product_check" CHECK ("product" IN ('bid', 'shop'))
);
--> statement-breakpoint
INSERT INTO "user_invitation_product_grant" ("invitation_id", "product", "role")
SELECT "id", 'bid', "target_staff_role"::text
FROM "user_invitation"
WHERE "target_role" = 'staff' AND "target_staff_role" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shop_staff_access_inbox" (
  "event_id" bigint PRIMARY KEY REFERENCES "domain_events"("id") ON DELETE RESTRICT,
  "event_type" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shop_staff_access_inbox_event_type_check" CHECK (
    "event_type" IN ('lax.staff_access.granted', 'lax.staff_access.revoked')
  ),
  CONSTRAINT "shop_staff_access_inbox_status_check" CHECK (
    "status" IN ('pending', 'completed', 'dead', 'failed')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shop_staff_access_inbox_status_created_idx"
  ON "shop_staff_access_inbox" ("status", "created_at");
