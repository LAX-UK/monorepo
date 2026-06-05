CREATE TABLE IF NOT EXISTS "onsite_event" (
  "slug" text PRIMARY KEY,
  "title" text NOT NULL,
  "starts_at" timestamp with time zone,
  "rsvp_close_at" timestamp with time zone,
  "segment_options" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "ops_email" text,
  "microsite_url" text,
  "status" text DEFAULT 'published' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "onsite_event_rsvp" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_slug" text NOT NULL,
  "user_id" text NOT NULL,
  "attendance_segment" text NOT NULL,
  "plus_one" smallint DEFAULT 0 NOT NULL,
  "plus_one_guest_name" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "onsite_event_rsvp_event_slug_onsite_event_slug_fk"
    FOREIGN KEY ("event_slug") REFERENCES "onsite_event"("slug") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "onsite_event_rsvp_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS "onsite_event_rsvp_event_user_uq"
  ON "onsite_event_rsvp" ("event_slug", "user_id");
CREATE INDEX IF NOT EXISTS "onsite_event_rsvp_event_slug_idx"
  ON "onsite_event_rsvp" ("event_slug");
CREATE INDEX IF NOT EXISTS "onsite_event_rsvp_user_idx"
  ON "onsite_event_rsvp" ("user_id");

INSERT INTO "onsite_event" (
  "slug",
  "title",
  "starts_at",
  "rsvp_close_at",
  "segment_options",
  "ops_email",
  "microsite_url",
  "status"
) VALUES (
  'lax001',
  'LAX 001: The First Hammer',
  '2026-06-18T18:00:00.000Z',
  '2026-06-18T16:00:00.000Z',
  '[
    {"value":"full_evening","label":"Full evening","helper":"Doors 6:00 PM through gala"},
    {"value":"auction_only","label":"Auction & preview","helper":"Arrive by 5:45 PM — live auction from 6:00 PM"},
    {"value":"gala_only","label":"Gala only","helper":"From 9:00 PM — celebration after the hammer"}
  ]'::jsonb,
  'events@lax.bid',
  'https://event.lax.bid',
  'published'
) ON CONFLICT ("slug") DO NOTHING;
