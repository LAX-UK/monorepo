CREATE TABLE "impersonation_session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE restrict,
  "target_legal_entity_id" uuid NOT NULL REFERENCES "legal_entity"("id") ON DELETE restrict,
  "started_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "ended_at" timestamptz,
  "end_reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "impersonation_session_active_idx"
  ON "impersonation_session" ("actor_user_id", "ended_at")
  WHERE "ended_at" IS NULL;

CREATE INDEX "impersonation_session_expires_idx"
  ON "impersonation_session" ("expires_at")
  WHERE "ended_at" IS NULL;
