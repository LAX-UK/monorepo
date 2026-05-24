CREATE TABLE "payment_refund_reconcile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"stripe_refund_id" text,
	"admin_user_id" text,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"reconciled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_refund_reconcile_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "payment_refund_reconcile_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "payment_refund_reconcile_pending_idx" ON "payment_refund_reconcile" USING btree ("created_at") WHERE "reconciled_at" IS NULL;
