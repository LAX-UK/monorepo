-- Pass and email metadata for onsite events

ALTER TABLE "onsite_event"
  ADD COLUMN IF NOT EXISTS "venue" text,
  ADD COLUMN IF NOT EXISTS "dress_code" text,
  ADD COLUMN IF NOT EXISTS "arrival_note" text;

UPDATE "onsite_event"
SET
  "venue" = 'Brunswick Art Gallery & Centre, London',
  "dress_code" = 'Smart formal',
  "arrival_note" = 'Doors 6:00 PM · Personal and non-transferable.'
WHERE "slug" = 'lax001' AND "venue" IS NULL;
