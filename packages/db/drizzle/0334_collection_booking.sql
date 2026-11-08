-- Collection booking: buyers book a time to collect paid works from the gallery, and staff set the
-- hours and rules. Hours are London wall-clock times ("10:00") kept as text; a booking's visit is
-- a pair of instants.
--
--   collection_place: one row per venue with the rules staff set (visit length, places at once,
--     the 16:00 cut-off, the booking window) and the online-booking switch that replaces the
--     COLLECTION_* environment variables (those stay as the fallback until the staff screens ship).
--   collection_weekly_hours: the regular opening hours; several rows per weekday are allowed.
--   collection_exception: closures (a day or part of one) and extra openings. Bank holidays and
--     sale days are added with their source, so staff can see why a day is closed.
--   collection_booking: one visit. It holds one numbered place ("seat") in its slot, and a partial
--     unique index on (venue, slot start, seat) while the booking is live is what stops two people
--     taking the same place, however many API instances run. The collector's name, email and
--     company are personal data of someone who may not have an account: they are erased with the
--     booker's account (see the persistence erasure) and never appear in domain events.
--   collection_booking_lot: the lots in a visit. A lot is in at most one live booking.
--   lot_fulfilment.collected_by_user_id: the staff member who handed the works over.
--
-- Additive: a sequence, five new tables and one nullable column, so running services keep working.
SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS "collection_booking_reference_seq" AS bigint MINVALUE 1 START WITH 1000;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_place" (
  "venue_id" uuid PRIMARY KEY NOT NULL,
  "online_booking_enabled" boolean DEFAULT false NOT NULL,
  "visit_minutes" smallint DEFAULT 30 NOT NULL,
  "places_per_slot" smallint DEFAULT 2 NOT NULL,
  "notice_cutoff_local" text DEFAULT '16:00' NOT NULL,
  "notice_working_days" smallint DEFAULT 1 NOT NULL,
  "window_days" smallint DEFAULT 28 NOT NULL,
  "close_on_sale_days" boolean DEFAULT true NOT NULL,
  "undo_hand_over_minutes" smallint DEFAULT 10 NOT NULL,
  "free_storage_days" smallint,
  "booking_email" text,
  "updated_by_user_id" text,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_place_visit_minutes_check" CHECK ("visit_minutes" IN (15, 20, 30, 45, 60)),
  CONSTRAINT "collection_place_places_check" CHECK ("places_per_slot" BETWEEN 1 AND 10),
  CONSTRAINT "collection_place_cutoff_check" CHECK ("notice_cutoff_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "collection_place_notice_days_check" CHECK ("notice_working_days" BETWEEN 1 AND 5),
  CONSTRAINT "collection_place_window_check" CHECK ("window_days" BETWEEN 7 AND 90),
  CONSTRAINT "collection_place_undo_check" CHECK ("undo_hand_over_minutes" BETWEEN 1 AND 60),
  CONSTRAINT "collection_place_storage_check" CHECK ("free_storage_days" IS NULL OR "free_storage_days" BETWEEN 0 AND 365),
  CONSTRAINT "collection_place_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict,
  CONSTRAINT "collection_place_updated_by_user_id_user_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_weekly_hours" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL,
  "weekday" smallint NOT NULL,
  "opens_local" text NOT NULL,
  "closes_local" text NOT NULL,
  CONSTRAINT "collection_weekly_hours_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  CONSTRAINT "collection_weekly_hours_opens_check" CHECK ("opens_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "collection_weekly_hours_closes_check" CHECK ("closes_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "collection_weekly_hours_order_check" CHECK ("closes_local" > "opens_local"),
  CONSTRAINT "collection_weekly_hours_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collection_weekly_hours_range_uidx"
  ON "collection_weekly_hours" ("venue_id", "weekday", "opens_local");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_exception" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "venue_id" uuid NOT NULL,
  "kind" text NOT NULL,
  "starts_on" date NOT NULL,
  "ends_on" date NOT NULL,
  "opens_local" text,
  "closes_local" text,
  "source" text DEFAULT 'staff' NOT NULL,
  "sale_id" uuid,
  "reason_internal" text,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "collection_exception_kind_check" CHECK ("kind" IN ('closure', 'extra_opening')),
  CONSTRAINT "collection_exception_source_check" CHECK ("source" IN ('staff', 'bank_holiday', 'sale')),
  CONSTRAINT "collection_exception_days_check" CHECK ("ends_on" >= "starts_on"),
  CONSTRAINT "collection_exception_hours_check" CHECK (
    ("opens_local" IS NULL AND "closes_local" IS NULL)
    OR (
      "opens_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "closes_local" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "closes_local" > "opens_local"
    )
  ),
  CONSTRAINT "collection_exception_sale_check" CHECK (
    ("source" = 'sale') = ("sale_id" IS NOT NULL)
  ),
  CONSTRAINT "collection_exception_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict,
  CONSTRAINT "collection_exception_sale_id_sale_id_fk"
    FOREIGN KEY ("sale_id") REFERENCES "public"."sale"("id") ON DELETE cascade,
  CONSTRAINT "collection_exception_created_by_user_id_user_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_exception_venue_days_idx"
  ON "collection_exception" ("venue_id", "starts_on", "ends_on")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
-- The bank holiday import and the sale closures can run again without adding a day twice.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_exception_bank_holiday_uidx"
  ON "collection_exception" ("venue_id", "starts_on")
  WHERE "source" = 'bank_holiday' AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collection_exception_sale_uidx"
  ON "collection_exception" ("venue_id", "sale_id")
  WHERE "source" = 'sale' AND "deleted_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_booking" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "reference" text DEFAULT ('COL-' || lpad(nextval('collection_booking_reference_seq')::text, 4, '0')) NOT NULL,
  "legal_entity_id" uuid NOT NULL,
  "venue_id" uuid NOT NULL,
  "slot_start" timestamp with time zone NOT NULL,
  "slot_end" timestamp with time zone NOT NULL,
  "seat" smallint NOT NULL,
  "status" text DEFAULT 'booked' NOT NULL,
  "booked_by_user_id" text,
  "booked_via" text DEFAULT 'client' NOT NULL,
  "over_capacity" boolean DEFAULT false NOT NULL,
  "over_capacity_reason" text,
  "collector_kind" text NOT NULL,
  "collector_name" text NOT NULL,
  "collector_email" text,
  "collector_company" text,
  "collector_user_id" text,
  "authorised_by_user_id" text,
  "authorised_at" timestamp with time zone,
  "policy_version" text,
  "ics_sequence" integer DEFAULT 0 NOT NULL,
  "idempotency_key" text NOT NULL,
  "id_check_type" text,
  "outcome_by_user_id" text,
  "outcome_at" timestamp with time zone,
  "cancelled_by_user_id" text,
  "cancelled_at" timestamp with time zone,
  "personal_details_erased_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "collection_booking_status_check" CHECK (
    "status" IN ('booked', 'collected', 'partly_collected', 'not_collected', 'cancelled')
  ),
  CONSTRAINT "collection_booking_booked_via_check" CHECK ("booked_via" IN ('client', 'staff')),
  CONSTRAINT "collection_booking_collector_kind_check" CHECK (
    "collector_kind" IN ('self', 'member', 'third_party')
  ),
  CONSTRAINT "collection_booking_id_check_type_check" CHECK (
    "id_check_type" IS NULL
    OR "id_check_type" IN ('passport', 'driving_licence', 'national_identity_card', 'other_photo_id')
  ),
  CONSTRAINT "collection_booking_slot_check" CHECK ("slot_end" > "slot_start"),
  CONSTRAINT "collection_booking_seat_check" CHECK ("seat" BETWEEN 1 AND 50),
  CONSTRAINT "collection_booking_sequence_check" CHECK ("ics_sequence" >= 0),
  CONSTRAINT "collection_booking_over_capacity_check" CHECK (
    "over_capacity" = false OR "booked_via" = 'staff'
  ),
  CONSTRAINT "collection_booking_legal_entity_id_legal_entity_id_fk"
    FOREIGN KEY ("legal_entity_id") REFERENCES "public"."legal_entity"("id") ON DELETE restrict,
  CONSTRAINT "collection_booking_venue_id_venue_id_fk"
    FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE restrict,
  CONSTRAINT "collection_booking_booked_by_user_id_user_id_fk"
    FOREIGN KEY ("booked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "collection_booking_collector_user_id_user_id_fk"
    FOREIGN KEY ("collector_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "collection_booking_authorised_by_user_id_user_id_fk"
    FOREIGN KEY ("authorised_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "collection_booking_outcome_by_user_id_user_id_fk"
    FOREIGN KEY ("outcome_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null,
  CONSTRAINT "collection_booking_cancelled_by_user_id_user_id_fk"
    FOREIGN KEY ("cancelled_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collection_booking_reference_uidx"
  ON "collection_booking" ("reference");
--> statement-breakpoint
-- A booking made twice with the same key (a double tap, a retry) is one booking.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_booking_idempotency_uidx"
  ON "collection_booking" ("legal_entity_id", "idempotency_key");
--> statement-breakpoint
-- No double booking: each live booking holds its own numbered place in the slot.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_booking_seat_live_uidx"
  ON "collection_booking" ("venue_id", "slot_start", "seat")
  WHERE "status" = 'booked';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_booking_day_idx"
  ON "collection_booking" ("venue_id", "slot_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_booking_account_idx"
  ON "collection_booking" ("legal_entity_id", "slot_start" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_booking_booked_by_idx"
  ON "collection_booking" ("booked_by_user_id")
  WHERE "booked_by_user_id" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collection_booking_lot" (
  "booking_id" uuid NOT NULL,
  "lot_id" uuid NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "outcome" text,
  CONSTRAINT "collection_booking_lot_pkey" PRIMARY KEY ("booking_id", "lot_id"),
  CONSTRAINT "collection_booking_lot_outcome_check" CHECK (
    "outcome" IS NULL OR "outcome" IN ('collected', 'left')
  ),
  CONSTRAINT "collection_booking_lot_booking_id_collection_booking_id_fk"
    FOREIGN KEY ("booking_id") REFERENCES "public"."collection_booking"("id") ON DELETE restrict,
  CONSTRAINT "collection_booking_lot_lot_id_lot_id_fk"
    FOREIGN KEY ("lot_id") REFERENCES "public"."lot"("id") ON DELETE restrict
);
--> statement-breakpoint
-- A lot is in at most one live booking.
CREATE UNIQUE INDEX IF NOT EXISTS "collection_booking_lot_active_uidx"
  ON "collection_booking_lot" ("lot_id")
  WHERE "active";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collection_booking_lot_lot_idx"
  ON "collection_booking_lot" ("lot_id");
--> statement-breakpoint
ALTER TABLE "lot_fulfilment" ADD COLUMN IF NOT EXISTS "collected_by_user_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lot_fulfilment"
    ADD CONSTRAINT "lot_fulfilment_collected_by_user_id_user_id_fk"
    FOREIGN KEY ("collected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
