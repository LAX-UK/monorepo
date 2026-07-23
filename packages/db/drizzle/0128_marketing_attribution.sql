CREATE TABLE IF NOT EXISTS "marketing_attribution" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "first_touch" jsonb,
  "last_touch" jsonb,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
