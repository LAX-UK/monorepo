CREATE TABLE IF NOT EXISTS "staff_role_assignment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "role" "user_staff_role" NOT NULL,
  "starts_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ends_at" timestamp with time zone,
  "granted_by_user_id" text,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reason" text
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_role_assignment" ADD CONSTRAINT "staff_role_assignment_user_id_bid_user_profile_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."bid_user_profile"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_role_assignment" ADD CONSTRAINT "staff_role_assignment_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "staff_role_assignment_open_uidx" ON "staff_role_assignment" USING btree ("user_id","role") WHERE "staff_role_assignment"."ends_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_role_assignment_user_idx" ON "staff_role_assignment" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "staff_role_assignment_role_idx" ON "staff_role_assignment" USING btree ("role");
--> statement-breakpoint
-- Every staff member keeps exactly the role they hold today, as their first assignment. It counts
-- from when their Bid profile was created so it is in force the moment the release starts.
INSERT INTO "staff_role_assignment" ("user_id", "role", "starts_at", "granted_by_user_id", "granted_at", "reason")
SELECT p."user_id", p."staff_role", p."created_at", NULL, now(), 'migrated from single role'
FROM "bid_user_profile" p
WHERE p."role" = 'staff' AND p."staff_role" IS NOT NULL
ON CONFLICT ("user_id", "role") WHERE "ends_at" IS NULL DO NOTHING;
