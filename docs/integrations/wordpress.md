# WordPress SSO

Recommended plugin: **OpenID Connect Generic**.

Configuration:

- Issuer / discovery URL: `https://auth.thealx.bid/.well-known/openid-configuration`
- JWKS URL: `https://auth.thealx.bid/.well-known/jwks.json`
- Client type: confidential web client
- Scopes: `openid profile email`
- Callback URL: `https://thealx.art/wp-admin/admin-ajax.php?action=openid-connect-authorize`
- User mapping:
  - `sub` → user meta `thealx_subject`
  - `email` → WordPress user email
  - `name` → display name

For v1, WordPress is a relying party only. It does not emit user events unless a future form/newsletter integration is added.
