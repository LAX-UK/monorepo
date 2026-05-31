DO $$ BEGIN
  CREATE TYPE "qr_code_entity_type" AS ENUM ('sale', 'lot');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "qr_code_status" AS ENUM ('active', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "qr_code" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "short_code" text NOT NULL,
  "entity_type" "qr_code_entity_type" NOT NULL,
  "entity_id" uuid NOT NULL,
  "is_default" boolean DEFAULT true NOT NULL,
  "campaign" text,
  "placement" text,
  "status" "qr_code_status" DEFAULT 'active' NOT NULL,
  "expires_at" timestamp with time zone,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qr_code_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "qr_code_scan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "qr_code_id" uuid NOT NULL,
  "scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ip_prefix" text,
  "country" text,
  "region" text,
  "city" text,
  "device_type" text,
  "browser" text,
  "os" text,
  "referrer_host" text,
  "request_id" text,
  CONSTRAINT "qr_code_scan_qr_code_id_qr_code_id_fk"
    FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_code"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "qr_code_scan_daily" (
  "qr_code_id" uuid NOT NULL,
  "day" timestamp with time zone NOT NULL,
  "country" text DEFAULT 'unknown' NOT NULL,
  "device_type" text DEFAULT 'unknown' NOT NULL,
  "scans" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "qr_code_scan_daily_qr_code_id_qr_code_id_fk"
    FOREIGN KEY ("qr_code_id") REFERENCES "public"."qr_code"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "qr_code_short_code_uid" ON "qr_code" ("short_code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qr_code_default_entity_uid" ON "qr_code" ("entity_type", "entity_id") WHERE "is_default" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_code_entity_idx" ON "qr_code" ("entity_type", "entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_code_status_idx" ON "qr_code" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_code_scan_code_time_idx" ON "qr_code_scan" ("qr_code_id", "scanned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_code_scan_time_idx" ON "qr_code_scan" ("scanned_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "qr_code_scan_daily_uid" ON "qr_code_scan_daily" ("qr_code_id", "day", "country", "device_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qr_code_scan_daily_code_day_idx" ON "qr_code_scan_daily" ("qr_code_id", "day");
