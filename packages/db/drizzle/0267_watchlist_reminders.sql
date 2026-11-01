-- Reminders on watched lots: when (as the sale starts, a day or an hour before the lot closes)
-- and an optional note, one per watched lot and removed with it. A worker job sends each one
-- once through the notification dispatcher; `sent_at` records that (or that it was dropped
-- because its moment passed).
SET LOCAL lock_timeout = '30s';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist_reminder" (
  "watchlist_id" uuid PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "lot_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "note" text,
  "sent_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "watchlist_reminder_kind_check"
    CHECK ("kind" IN ('sale_start', 'day_before_close', 'hour_before_close')),
  CONSTRAINT "watchlist_reminder_note_length" CHECK (char_length("note") <= 500),
  CONSTRAINT "watchlist_reminder_watchlist_id_watchlist_id_fk"
    FOREIGN KEY ("watchlist_id") REFERENCES "public"."watchlist"("id") ON DELETE cascade,
  CONSTRAINT "watchlist_reminder_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade,
  CONSTRAINT "watchlist_reminder_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_reminder_user_idx" ON "watchlist_reminder" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_reminder_pending_idx"
  ON "watchlist_reminder" ("lot_id") WHERE "sent_at" IS NULL;
