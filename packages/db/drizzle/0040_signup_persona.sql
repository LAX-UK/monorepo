-- Phase B: signup persona persisted on user (drives post-verify routing + dashboard CTAs)

ALTER TABLE "user"
  ADD COLUMN "signup_persona" text;
