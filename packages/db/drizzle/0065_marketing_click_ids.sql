CREATE TABLE IF NOT EXISTS "marketing_click_ids" (
  "user_id" text PRIMARY KEY NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "fbp" text,
  "fbc" text,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
