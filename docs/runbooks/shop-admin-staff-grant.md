# Shop admin staff grant (test / break-glass)

Shop admin authorization is product-owned (`shop_staff_member`). Identity only proves who signed in.

## Grants from LAX invitations (normal path)

Administrators grant Shop access from Bid: **Admin → People → Invite**, staff mode, then switch on **Shop** and pick a role (D36). On acceptance, Bid writes a `lax.staff_access.granted` event and the `staff-access` task in `shop-api` applies it within a minute.

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

Changes made later from Bid (**Admin → Staff → person → LAX access**) take the same path. Until Shop applies a change, Bid shows it as pending. A change that stays pending for more than a few minutes usually means its inbox row is `failed` or `dead`.

Compare what Bid shows with what Shop applied:

```sql
SELECT subject_id, product, role, updated_at
FROM lax_staff_access_directory
WHERE subject_id = '<identity-subject-id>';
```

## Grants from Shop Admin

Shop admins can grant a role directly at **Staff → Add staff by email**. The email must match an active LAX login that Shop knows (`shop_user_profile`). If it doesn't, invite the person from Bid instead. The page links to Bid's staff screen when `LAX_BID_PUBLIC_URL` is set for `shop-admin`.

## Product switcher

Each staff tool lists the other in its switcher only for people who can open it. Both ask the Bid API's `GET /admin/staff/my-tools`, which answers only about the caller. Bid admin calls it with the person's Bid session; Shop Admin exchanges the person's session ID token (RFC 8693) for a `lax-bid-api` token with the read-only `lax.staff.tools.read` scope, calls it at `BID_API_INTERNAL_BASE_URL`, and reuses the answer for a minute per person. If that call fails or is not configured, Shop Admin shows itself alone, so a missing Bid link after a grant usually means the call is failing, not that the grant is missing. Each tool still enforces its own permissions when the link is followed.

## Confirm grant for a subject (break-glass)

```bash
pnpm --filter @auction/shop-api staff:grant --subject <identity-subject-id> --role <role>
```

If sign-in succeeds at auth but shop admin shows `not_authorized`, the subject lacks a staff row.

## MFA

Two-step verification for staff follows the staff policy (D35), set by a Bid administrator at **Admin → People → Security**. It is on by default. While it is on, staff who signed in with Google or Apple pass; everyone else completes TOTP at `/two-factor`, and staff without an authenticator are sent to `/two-factor/setup?required_by=staff` at their next sign-in. Granting a Shop staff role marks the subject as staff immediately, so the policy applies from their next sign-in.
