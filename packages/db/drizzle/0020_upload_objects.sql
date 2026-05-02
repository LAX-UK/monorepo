CREATE TABLE IF NOT EXISTS "upload_object" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"declared_content_type" text NOT NULL,
	"declared_byte_size" integer NOT NULL,
	"actual_content_type" text,
	"actual_byte_size" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_at" timestamp with time zone,
	"validated_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "upload_object_key_unique" UNIQUE("key"),
	CONSTRAINT "upload_object_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "upload_object_owner_status_idx" ON "upload_object" USING btree ("owner_user_id", "status");
CREATE INDEX IF NOT EXISTS "upload_object_status_expires_idx" ON "upload_object" USING btree ("status", "expires_at");
