# Shop admin staff grant (test / break-glass)

Shop admin authorization is product-owned (`shop_staff_member`). Identity only proves who signed in.

## Confirm grant for a subject

```bash
pnpm --filter @auction/shop-api staff:grant --subject <identity-subject-id> --role <role>
```

If sign-in succeeds at auth but shop admin shows `not_authorized`, the subject lacks a staff row.

## MFA

Two-step verification for staff follows the staff policy (D35), set by a Bid super admin at **Admin → People → Security**. It is on by default. While it is on, staff who signed in with Google or Apple pass; everyone else completes TOTP at `/two-factor`, and staff without an authenticator are sent to `/two-factor/setup?required_by=staff` at their next sign-in. Granting a Shop staff role marks the subject as staff immediately, so the policy applies from their next sign-in.
