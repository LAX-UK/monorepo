-- V1 roles + invitations
UPDATE "user" SET "role" = 'administrator' WHERE "role" = 'admin';
UPDATE "user" SET "role" = 'client' WHERE "role" IN ('user', 'buyer', 'seller');

ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'client';

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_role_v1_check";
ALTER TABLE "user" ADD CONSTRAINT "user_role_v1_check" CHECK ("role" IN ('administrator', 'accountant', 'client'));

CREATE TYPE "public"."invitation_status" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

CREATE TABLE "user_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"target_role" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_user_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitation_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "user_invitation_accepted_user_id_user_id_fk" FOREIGN KEY ("accepted_user_id") REFERENCES "public"."user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
	CONSTRAINT "user_invitation_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
	CONSTRAINT "user_invitation_target_role_check" CHECK ("target_role" IN ('administrator', 'accountant', 'client'))
);

CREATE INDEX "user_invitation_email_idx" ON "user_invitation" USING btree ("email");
CREATE INDEX "user_invitation_created_by_idx" ON "user_invitation" USING btree ("created_by_user_id");
