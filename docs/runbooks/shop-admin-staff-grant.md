# Shop admin staff grant (test / break-glass)

Shop admin authorization is product-owned (`shop_staff_member`). Identity only proves who signed in.

## Confirm grant for a subject

```bash
pnpm --filter @auction/shop-api staff:grant --subject <identity-subject-id> --role <role>
```

If sign-in succeeds at auth but shop admin shows `not_authorized`, the subject lacks a staff row.

## MFA

Staff clients request silver ACR. Users without an authenticator are sent to `/two-factor/setup` during sign-in.
