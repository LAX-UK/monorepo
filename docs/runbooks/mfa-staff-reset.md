# Staff-assisted MFA reset (support)

Use when a shop staff member lost both their authenticator and backup codes.

## Preconditions

- Caller verified out-of-band (support ticket + identity proof per internal policy).
- Machine client with `identity.lifecycle` scope.

## Reset

```http
POST /identity/subjects/{subjectId}/two-factor/reset
Authorization: Bearer {machine_token}
```

The subject must sign in again and complete `/two-factor/setup` before shop admin (silver ACR) succeeds.

## Audit

Each reset publishes `user.credential_changed` with `changeType: revoke`. Record the ticket id in your support system.
