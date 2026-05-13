# Migration 0041 journal gap

`0041_org_onboarding.sql` existed on disk but was missing from `packages/db/drizzle/meta/_journal.json` until the follow-up fix, so automated `pnpm db:migrate` never applied it on some timelines.

## Current state

- **0041** is registered in the journal (between 0040 and 0042).
- **0043_org_onboarding_idempotent_replay** repeats the same DDL with `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` so databases that already applied **0042_email_change_connect_payment_cancel_hotpath_indexes** (or any later migration) before 0041 was journal-registered still converge without manual SQL.

## Verify an environment

```sql
SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

Confirm hashes for `0041_org_onboarding`, `0042_email_change_connect_payment_cancel_hotpath_indexes`, and `0043_org_onboarding_idempotent_replay` appear after migrate.

## Stuck in-flight email change (ops)

If a user cannot complete dual confirmation and needs a reset:

```sql
UPDATE "user"
SET pending_new_email = NULL,
    email_change_old_ok = false,
    email_change_new_ok = false,
    email_change_expires_at = NULL,
    updated_at = now()
WHERE id = '<user_id>';
```

Prefer the self-serve **Cancel email change** API (`DELETE /auth/change-email`) when available.
