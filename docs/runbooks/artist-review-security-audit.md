# Artist review / merge — post-hotfix audit

After deploying the hotfix that gates `POST /artists`, `POST /artists/:id/review`, `POST /artists/:id/merge`, and `POST /artists/propose-matches` behind the `artist.review` / `artist.merge` capabilities (staff-only), review historical rows where a non-staff (or staff without the right `staff_role`) may have changed catalogue state. (`propose-matches` does not persist reviewer id; this runbook focuses on approve/merge attribution.)

`artist_profile.reviewed_by_user_id` is set on approve, reject, and merge flows. There is no `domain_events` stream for every artist decision in v1, so use SQL against `artist_profile` + `"user"`.

## Flag approvals not performed by staff with `artist.review`

After migration `0054_role_staff_client`, `user.role ∈ {'staff','client'}` and `artist.review` is held by `staff_role ∈ {'super_admin','catalogue_manager','specialist'}`. Run read-only against production (or a snapshot):

```sql
SELECT
  ap.id,
  ap.display_name,
  ap.status,
  ap.reviewed_at,
  ap.reviewed_by_user_id,
  u.email AS reviewer_email,
  u.role AS reviewer_role_raw,
  u.staff_role AS reviewer_staff_role
FROM artist_profile AS ap
LEFT JOIN "user" AS u ON u.id = ap.reviewed_by_user_id
WHERE
  ap.status = 'approved'
  AND ap.reviewed_by_user_id IS NOT NULL
  AND (
    lower(trim(coalesce(u.role, ''))) <> 'staff'
    OR coalesce(u.staff_role, '') NOT IN ('super_admin', 'catalogue_manager', 'specialist')
  );
```

Treat any row returned as **needs human review** (possible abuse before the hotfix). The `RoleCapability` matrix lives in `packages/types/src/role-policy.ts`; keep this query in sync if the matrix changes.

## Merged artists

For `status = 'merged_into'`, `reviewed_by_user_id` records who ran the merge. `artist.merge` is held by `staff_role ∈ {'super_admin','catalogue_manager'}` (specialists can review but not merge).

```sql
SELECT ap.id, ap.display_name, ap.reviewed_at, ap.reviewed_by_user_id, u.email, u.role, u.staff_role
FROM artist_profile AS ap
LEFT JOIN "user" AS u ON u.id = ap.reviewed_by_user_id
WHERE ap.status = 'merged_into'
  AND ap.reviewed_by_user_id IS NOT NULL
  AND (
    lower(trim(coalesce(u.role, ''))) <> 'staff'
    OR coalesce(u.staff_role, '') NOT IN ('super_admin', 'catalogue_manager')
  );
```

## Remediation

Decisions are product/legal: revert merge (manual runbook), re-open artist as pending, or leave as-is with a ticket. Prefer capability-based gates (`artist.review` / `artist.merge`) instead of a blanket `requirePlatformAdmin` check where those capabilities exist.
