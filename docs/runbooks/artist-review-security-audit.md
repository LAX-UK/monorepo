# Artist review / merge — post-hotfix audit

After deploying the hotfix that gates `POST /artists/:id/review`, `POST /artists/:id/merge`, and `POST /artists/propose-matches` with platform administrator capability, review historical rows where a non-administrator may have changed catalogue state. (`propose-matches` does not persist reviewer id; this runbook focuses on approve/merge attribution.)

`artist_profile.reviewed_by_user_id` is set on approve, reject, and merge flows. There is no `domain_events` stream for every artist decision in v1, so use SQL against `artist_profile` + `"user"`.

## Flag approvals not performed by a platform administrator

Run read-only against production (or a snapshot):

```sql
SELECT
  ap.id,
  ap.display_name,
  ap.status,
  ap.reviewed_at,
  ap.reviewed_by_user_id,
  u.email AS reviewer_email,
  u.role AS reviewer_role_raw
FROM artist_profile AS ap
LEFT JOIN "user" AS u ON u.id = ap.reviewed_by_user_id
WHERE
  ap.status = 'approved'
  AND ap.reviewed_by_user_id IS NOT NULL
  AND lower(trim(coalesce(u.role, ''))) NOT IN ('administrator');
```

Treat any row returned as **needs human review** (possible abuse before the hotfix). If your `"user".role` column still contains legacy values (e.g. `admin`), extend the `NOT IN` list or normalize in a one-off migration to match `UserRole` in `packages/types/src/user.ts`.

## Merged artists

For `status = 'merged_into'`, `reviewed_by_user_id` records who ran the merge. Use the same filter on `u.role` if you need to audit merges.

```sql
SELECT ap.id, ap.display_name, ap.reviewed_at, ap.reviewed_by_user_id, u.email, u.role
FROM artist_profile AS ap
LEFT JOIN "user" AS u ON u.id = ap.reviewed_by_user_id
WHERE ap.status = 'merged_into'
  AND ap.reviewed_by_user_id IS NOT NULL
  AND lower(trim(coalesce(u.role, ''))) NOT IN ('administrator');
```

## Remediation

Decisions are product/legal: revert merge (manual runbook), re-open artist as pending, or leave as-is with a ticket. Prefer capability-based gates (`artist.review` / `artist.merge`) instead of a blanket `requirePlatformAdmin` check where those capabilities exist.
