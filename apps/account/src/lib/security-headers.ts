export type SecurityHeader = { key: string; value: string };

/**
 * Response headers for every Account page.
 *
 * Script and style stay `'unsafe-inline'` because Next.js inlines its bootstrap script and
 * streamed RSC payload, and a per-request nonce would need middleware on every route; the other
 * directives are what carry the protection. Account loads only its own origin: fonts are
 * self-hosted by `next/font`, the lockups are inline SVG or same-origin files, and the browser
 * never calls another origin (sign-in is a full-page redirect to the issuer, so `form-action`
 * is left unrestricted because it also governs redirects after a form post, such as sign-out).
 * The one exception is images: the portfolio shows each work's picture from the product that
 * owns it, on that product's media host, so `img-src` allows https images (and local http in
 * development). Images cannot run script, and the page never builds a URL from user input.
 * Development needs `'unsafe-eval'` for React's debugging and `ws:` for hot reload.
 */
export function securityHeaders(options: { development: boolean }): SecurityHeader[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: https:${options.development ? " http://localhost:* http://127.0.0.1:*" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${options.development ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
  ];
}
