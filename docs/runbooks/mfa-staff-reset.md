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

If the staff or organisation policy applies to the subject (D35), they are sent to `/two-factor/setup` at their next sign-in unless they sign in with Google or Apple. Otherwise two-step verification stays off until they turn it on again.

## Audit

Each reset publishes `user.credential_changed` with `changeType: revoke`. Record the ticket id in your support system.
