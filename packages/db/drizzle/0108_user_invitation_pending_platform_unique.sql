-- Collapse any pre-existing duplicate *pending platform* invitations (keep the
-- newest by created_at: the invitee most likely holds the latest email link) so
-- the partial unique index can be created cleanly.
-- Entity-scoped invites (target_legal_entity_id IS NOT NULL) are intentionally
-- excluded: multiple pending entity invites for one email are legitimate.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY lower(email)
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM "user_invitation"
  WHERE status = 'pending' AND target_legal_entity_id IS NULL
)
UPDATE "user_invitation" ui
SET status = 'revoked', updated_at = now()
FROM ranked r
WHERE ui.id = r.id AND r.rn > 1;

-- Hard concurrency guard: at most one pending platform invitation per email.
CREATE UNIQUE INDEX IF NOT EXISTS "user_invitation_pending_platform_email_uidx"
  ON "user_invitation" (lower(email))
  WHERE status = 'pending' AND target_legal_entity_id IS NULL;
