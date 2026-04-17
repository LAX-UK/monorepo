ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
CREATE INDEX IF NOT EXISTS "notification_archived_at_idx" ON "notification" ("archived_at");

CREATE TABLE IF NOT EXISTS "notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL UNIQUE,
	"outbid_in_app" boolean DEFAULT true NOT NULL,
	"won_in_app" boolean DEFAULT true NOT NULL,
	"lost_in_app" boolean DEFAULT true NOT NULL,
	"ending_soon_in_app" boolean DEFAULT true NOT NULL,
	"watchlist_in_app" boolean DEFAULT true NOT NULL,
	"payment_in_app" boolean DEFAULT true NOT NULL,
	"outbid_push" boolean DEFAULT true NOT NULL,
	"won_push" boolean DEFAULT true NOT NULL,
	"ending_soon_push" boolean DEFAULT false NOT NULL,
	"quiet_start" text,
	"quiet_end" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE TABLE IF NOT EXISTS "push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL UNIQUE,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX IF NOT EXISTS "push_subscription_user_id_idx" ON "push_subscription" ("user_id");
