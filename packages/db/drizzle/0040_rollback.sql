-- Rollback for 0040_signup_persona.sql

ALTER TABLE "user"
  DROP COLUMN IF EXISTS "signup_persona";
