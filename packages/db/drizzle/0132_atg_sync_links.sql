CREATE TABLE IF NOT EXISTS "atg_auction_link" (
	"sale_id" uuid PRIMARY KEY NOT NULL,
	"atg_auction_id" text,
	"atg_auction_reference" text,
	"remote_status" text DEFAULT 'pending' NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"payload_hash" text,
	"last_synced_at" timestamp with time zone,
	"last_polled_at" timestamp with time zone,
	"last_error" text,
	"results_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atg_auction_link_sale_id_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "atg_auction_link_remote_status_idx" ON "atg_auction_link" USING btree ("remote_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "atg_lot_link" (
	"lot_id" uuid PRIMARY KEY NOT NULL,
	"sale_id" uuid NOT NULL,
	"atg_lot_id" text NOT NULL,
	"image_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload_hash" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"current_max_bid" numeric(12, 2),
	"number_of_bids" integer,
	"sold" boolean,
	"hammer_price" numeric(12, 2),
	"winning_bidder_id" text,
	"status" text,
	"last_polled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "atg_lot_link_lot_id_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "atg_lot_link_sale_id_atg_auction_link_sale_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."atg_auction_link"("sale_id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "atg_lot_link_sale_id_idx" ON "atg_lot_link" USING btree ("sale_id");
