# Shop admin staff grant (test / break-glass)

Shop admin authorization is product-owned (`shop_staff_member`). Identity only proves who signed in.

## Grants from LAX invitations (normal path)

Super admins grant Shop access from Bid: **Admin → People → Invite**, staff mode, then switch on **Shop** and pick a role (D36). On acceptance, Bid writes a `lax.staff_access.granted` event and the `staff-access` task in `shop-api` applies it within a minute.

Check delivery:

```sql
SELECT event_id, event_type, status, attempts, last_error, processed_at
FROM shop_staff_access_inbox
ORDER BY created_at DESC
LIMIT 20;
```

- `completed` — the grant is live and audited in `shop_admin_audit` (`staff_grant_create`, actor = the inviter).
- `failed` — transient failure; it retries until 8 attempts, then becomes `dead`.
- `dead` — not retried; ops got a `staff_access_dead` alert. Typical causes: last-admin protection on a revoke, or a role Shop doesn't know. Fix the roster by hand in Shop Admin (or with the CLI below), then leave the row as the record of what happened.

## Confirm grant for a subject (break-glass)

```bash
pnpm --filter @auction/shop-api staff:grant --subject <identity-subject-id> --role <role>
```

If sign-in succeeds at auth but shop admin shows `not_authorized`, the subject lacks a staff row.

## MFA

Two-step verification for staff follows the staff policy (D35), set by a Bid super admin at **Admin → People → Security**. It is on by default. While it is on, staff who signed in with Google or Apple pass; everyone else completes TOTP at `/two-factor`, and staff without an authenticator are sent to `/two-factor/setup?required_by=staff` at their next sign-in. Granting a Shop staff role marks the subject as staff immediately, so the policy applies from their next sign-in.
