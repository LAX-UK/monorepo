# cloudflare-domain

Manages host-scoped DNS records, Cloudflare zone settings, OIDC cache rules, auth/webhook rate limits, and auth WAF rules.

Rate-limit rules:

- `/webhooks/postmark` on `api_hosts`: `postmark_webhook_rpm` req/min/IP (default 500), 60s mitigation.
- `/api/auth/sign-up` on `auth_hosts`: `signup_rpm` req/min/IP (default 10), 60s mitigation.
- `/api/auth/send-verification-email` on `auth_hosts`: `send_verification_email_rpm` req/min/IP (default 5), 60s mitigation.
