# JWT Signing Key Leak

1. Disable affected deployment credentials.
2. Run `pnpm jwks:rotate` ([jwks-rotation.md](./jwks-rotation.md)): the new key becomes active and the leaked key becomes `rotating`, still published.
3. Confirm the new kid is signing.
4. Keep the leaked key in JWKS for the minimum viable overlap only if user impact requires it; otherwise set it to `retired` immediately and expect active access tokens to fail.
5. Rotate `BETTER_AUTH_SECRET`.
6. Revoke refresh/session tokens if the leak source is unknown.
7. Review DB role access and audit logs.

Normal non-incident rotation uses the 30-minute retirement window in `docs/security/key-rotation.md`.
