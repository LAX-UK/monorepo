# JWT Signing Key Leak

1. Disable affected deployment credentials.
2. Insert a new `jwks_key` with status `rotating`.
3. Force the new key active.
4. Keep leaked key in JWKS for the minimum viable overlap only if user impact requires it; otherwise revoke immediately and expect active access tokens to fail.
5. Rotate `BETTER_AUTH_SECRET`.
6. Revoke refresh/session tokens if the leak source is unknown.
7. Review DB role access and audit logs.

Normal non-incident rotation uses the 30-minute retirement window in `docs/security/key-rotation.md`.
