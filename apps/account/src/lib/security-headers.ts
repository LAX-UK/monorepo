export type SecurityHeader = { key: string; value: string };

/** Where Stripe's embedded Connect components load their script and frames from. */
const STRIPE_CONNECT_SCRIPT_ORIGINS = ["https://connect-js.stripe.com", "https://js.stripe.com"];

/** The page that shows Stripe's payout setup, the one place Stripe is allowed. */
export const STRIPE_CONNECT_PATH = "/account/selling/payouts";

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
 * The payouts page is the other exception: it shows Stripe's own payout setup forms, so with
 * `stripeConnect` it also allows Stripe's script, frames, images and API, and nothing else does.
 * Development needs `'unsafe-eval'` for React's debugging and `ws:` for hot reload.
 */
export function securityHeaders(options: {
  development: boolean;
  /** Origins product images load from; see `parseMediaOrigins`. */
  imageOrigins: readonly string[];
  /** Allow Stripe's embedded Connect components (the payouts page only). */
  stripeConnect?: boolean;
}): SecurityHeader[] {
  const stripe = options.stripeConnect === true;
  const csp = [
    "default-src 'self'",
    [
      `script-src 'self' 'unsafe-inline'${options.development ? " 'unsafe-eval'" : ""}`,
      ...(stripe ? STRIPE_CONNECT_SCRIPT_ORIGINS : []),
    ].join(" "),
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data:",
      ...options.imageOrigins,
      ...(stripe ? ["https://*.stripe.com"] : []),
    ].join(" "),
    "font-src 'self'",
    [
      `connect-src 'self'${options.development ? " ws: wss:" : ""}`,
      ...(stripe ? ["https://api.stripe.com"] : []),
    ].join(" "),
    ...(stripe ? [["frame-src", ...STRIPE_CONNECT_SCRIPT_ORIGINS].join(" ")] : []),
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
