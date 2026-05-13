# Email Provider Incident

## During The Incident

1. Set `REQUIRE_EMAIL_VERIFICATION=false` for `apps/auth` and `apps/api`, then redeploy both. This disables sign-in enforcement only; Better Auth still attempts to send verification email and outbox retries continue.
2. Add a sign-in/register banner if the outage is user-visible: "Email service is temporarily impaired; verification will be required again once restored."
3. Silence known Postmark transient alerts for the incident window to avoid alert fatigue.

## After Recovery

1. Identify affected registrations:

```sql
SELECT id, email, created_at
FROM "user"
WHERE created_at BETWEEN $incident_start AND $incident_end
  AND email_verified = false;
```

2. Default recovery: call `auth.api.sendVerificationEmail({ body: { email: user.email } })` for each affected user. Better Auth generates the token and triggers the configured `sendVerificationEmail` hook.
3. Last resort only: backfill `email_verified=true` for the affected window, with a manual auth/security log explaining why re-verification could not be used.
4. Re-enable `REQUIRE_EMAIL_VERIFICATION=true` and redeploy `apps/auth` and `apps/api`.
