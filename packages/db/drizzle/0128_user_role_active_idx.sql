CREATE INDEX IF NOT EXISTS "user_role_active_idx" ON "user" ("role") WHERE "suspended_at" IS NULL;
