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
 * owns it, so `img-src` lists only the configured LAX media origins, and the page drops any
 * image URL outside them.
 * Development needs `'unsafe-eval'` for React's debugging and `ws:` for hot reload.
 */
export function securityHeaders(options: {
  development: boolean;
  /** Origins product images load from; see `parseMediaOrigins`. */
  imageOrigins: readonly string[];
}): SecurityHeader[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    ["img-src 'self' data:", ...options.imageOrigins].join(" "),
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
