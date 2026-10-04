SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
ALTER TABLE "shop_admin_command" DROP CONSTRAINT "shop_admin_command_pkey";
--> statement-breakpoint
ALTER TABLE "shop_admin_command"
  ADD CONSTRAINT "shop_admin_command_pkey"
  PRIMARY KEY ("command_type", "actor_subject_id", "idempotency_key");
