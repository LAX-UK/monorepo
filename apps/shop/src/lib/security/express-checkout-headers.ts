export type SecurityHeader = { key: string; value: string };

/**
 * The Shop pages that show Stripe's Express Checkout Element (GAP-49): the basket and Details.
 * Confirmation, cancel and every other page never load Stripe.js.
 */
export const EXPRESS_CHECKOUT_PATHS: readonly string[] = ["/basket", "/checkout"];

/** Link (an approved wallet) needs its own hosts, listed in the same guide. */
export const STRIPE_LINK_FRAME_SOURCES = ["https://link.com", "https://*.link.com"];
export const STRIPE_LINK_CONNECT_SOURCES = ["https://link.com", "https://*.link.com"];
export const STRIPE_LINK_IMG_SOURCES = ["https://*.link.com"];

/**
 * Stripe's documented Content-Security-Policy sources for Stripe.js and Elements
 * (https://docs.stripe.com/security/guide#content-security-policy): the script and its frames
 * come from js.stripe.com, 3-D Secure and wallet hand-offs open frames on hooks.stripe.com, and
 * Stripe.js calls api.stripe.com.
 */
export const STRIPE_JS_SCRIPT_SOURCES = ["https://js.stripe.com", "https://*.js.stripe.com"];
export const STRIPE_JS_FRAME_SOURCES = [
  "https://js.stripe.com",
  "https://*.js.stripe.com",
  "https://hooks.stripe.com",
  ...STRIPE_LINK_FRAME_SOURCES,
];
export const STRIPE_JS_CONNECT_SOURCES = ["https://api.stripe.com"];
export const STRIPE_JS_IMG_SOURCES = ["https://*.stripe.com"];

/** The CDN shop-api serves uploaded media from (also in next.config.ts). */
export const MEDIA_CDN_ORIGIN = "https://lax-media.lon1.cdn.digitaloceanspaces.com";

export function isExpressCheckoutPath(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return EXPRESS_CHECKOUT_PATHS.includes(path);
}

/** The origin of each configured URL, dropping blanks and anything that is not http(s). */
export function originsOf(urls: readonly (string | undefined)[]): string[] {
  const origins = new Set<string>();
  for (const url of urls) {
    if (!url?.trim()) continue;
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") origins.add(parsed.origin);
    } catch {
      // A malformed URL is left out rather than widening the policy.
    }
  }
  return [...origins];
}

/**
 * The policy for the two express checkout pages. Script and style keep `'unsafe-inline'` because
 * Next.js inlines its bootstrap script and RSC payload. `connect-src` also names the identity
 * origins, because silent sign-in (FedCM) runs on every page for signed-out shoppers. `img-src`
 * is required for Stripe's and Link's images, so it also names the Shop's own image hosts. Fonts
 * and media are not restricted here: the Shop has no site-wide policy yet.
 */
export function expressCheckoutContentSecurityPolicy(options: {
  development: boolean;
  identityOrigins: readonly string[];
  imageOrigins?: readonly string[];
}): string {
  return [
    [
      `script-src 'self' 'unsafe-inline'${options.development ? " 'unsafe-eval'" : ""}`,
      ...STRIPE_JS_SCRIPT_SOURCES,
    ].join(" "),
    ["frame-src 'self'", ...STRIPE_JS_FRAME_SOURCES].join(" "),
    [
      `connect-src 'self'${options.development ? " ws: wss:" : ""}`,
      ...options.identityOrigins,
      ...STRIPE_JS_CONNECT_SOURCES,
      ...STRIPE_LINK_CONNECT_SOURCES,
    ].join(" "),
    [
      "img-src 'self' data: blob:",
      MEDIA_CDN_ORIGIN,
      ...(options.imageOrigins ?? []),
      ...STRIPE_JS_IMG_SOURCES,
      ...STRIPE_LINK_IMG_SOURCES,
    ].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Headers a Shop page adds for express checkout: the policy above on the basket and Details
 * while SHOP_EXPRESS_CHECKOUT is on, and nothing anywhere else or while it is off.
 */
export function expressCheckoutSecurityHeaders(options: {
  pathname: string;
  enabled: boolean;
  development: boolean;
  identityOrigins: readonly string[];
  imageOrigins?: readonly string[];
}): SecurityHeader[] {
  if (!options.enabled || !isExpressCheckoutPath(options.pathname)) return [];
  return [
    {
      key: "Content-Security-Policy",
      value: expressCheckoutContentSecurityPolicy(options),
    },
  ];
}
