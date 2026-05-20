ALTER TABLE "user_invitation" ADD COLUMN IF NOT EXISTS "opened_at" timestamptz;
ALTER TABLE "user_invitation" ADD COLUMN IF NOT EXISTS "last_email_outbox_id" uuid REFERENCES "email_outbox"("id") ON DELETE SET NULL;
