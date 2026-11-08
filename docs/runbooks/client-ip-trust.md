# Client IP trust at the edge

Rate limits (sign-in, bidding, enquiries) and audit logs key on the client IP. The apps resolve it
in one place, `@auction/http-headers/client-ip`. This note is what the edge must guarantee for that
to be safe. No infra is changed by the code that introduced it.

## How the address is derived

1. Peer is not a trusted proxy: the socket address; every forwarding header is ignored.
2. `DO-Connecting-IP`; when that hop is a Cloudflare edge, `CF-Connecting-IP` instead.
3. `X-Forwarded-For` walked from the right, skipping proxies we operate (trusted CIDRs, Cloudflare
   ranges, and the right-most `TRUSTED_PROXY_HOPS - 1` entries). The leftmost entry is never used
   on its own.
4. `X-Real-IP`, then the socket address.

`TRUSTED_PROXY_HOPS` (auth: `AUTH_TRUSTED_PROXY_HOPS`) defaults to `1`, the App Platform ingress.
Raise it only if another proxy that is outside the trusted CIDRs appends to `X-Forwarded-For`.
`apps/auth` keeps a copy of the same rules (Identity may not import other packages) and takes
`AUTH_TRUSTED_PROXY_HOPS`.
Fastify (shop-api) runs with `trustProxy: false`; it never reads forwarding headers.

## What the edge must guarantee

- **Cloudflare sets `CF-Connecting-IP`** to the real visitor and overwrites any value the client
  sent. Cloudflare also appends the visitor to `X-Forwarded-For`.
- **The origin accepts traffic only from Cloudflare** (Cloudflare IP allowlist or Authenticated
  Origin Pulls on the App Platform / load balancer). Otherwise a caller who reaches the origin
  directly can send their own `CF-Connecting-IP` or `X-Forwarded-For` and pick their own bucket.
- **The platform ingress appends** the address it saw to `X-Forwarded-For` and sets
  `DO-Connecting-IP`; it must not pass a client-supplied `DO-Connecting-IP` through.
- Keep `TRUSTED_CLOUDFLARE_PROXY_CIDRS` current with https://www.cloudflare.com/ips/.

## Check

From outside, `curl -H 'X-Forwarded-For: 1.2.3.4' -H 'CF-Connecting-IP: 1.2.3.4' <origin-host>`
directly against the origin must be refused. Through Cloudflare, repeated requests with different
forged `X-Forwarded-For` values must hit the same rate-limit bucket.
