import { describe, expect, it } from "vitest";
import {
  MEDIA_CDN_ORIGIN,
  STRIPE_JS_CONNECT_SOURCES,
  STRIPE_JS_FRAME_SOURCES,
  STRIPE_JS_IMG_SOURCES,
  STRIPE_JS_SCRIPT_SOURCES,
  STRIPE_LINK_CONNECT_SOURCES,
  STRIPE_LINK_FRAME_SOURCES,
  STRIPE_LINK_IMG_SOURCES,
  expressCheckoutContentSecurityPolicy,
  expressCheckoutSecurityHeaders,
  isExpressCheckoutPath,
  originsOf,
} from "./express-checkout-headers";

const IDENTITY = ["https://identity.lax.bid"];
const IMAGE_HOSTS = ["https://images.example.com"];

// Every non-self source the policy may carry: the configured app origins plus Stripe's documented
// sources (https://docs.stripe.com/security/guide#content-security-policy). Anything else fails.
const ALLOWED_SOURCES = new Set<string>([
  ...IDENTITY,
  ...IMAGE_HOSTS,
  MEDIA_CDN_ORIGIN,
  ...STRIPE_JS_SCRIPT_SOURCES,
  ...STRIPE_JS_FRAME_SOURCES,
  ...STRIPE_JS_CONNECT_SOURCES,
  ...STRIPE_JS_IMG_SOURCES,
  ...STRIPE_LINK_FRAME_SOURCES,
  ...STRIPE_LINK_CONNECT_SOURCES,
  ...STRIPE_LINK_IMG_SOURCES,
]);
const ALLOWED_KEYWORDS = new Set(["'self'", "'none'", "'unsafe-inline'", "data:", "blob:"]);

function csp(pathname: string, enabled = true, development = false): string | undefined {
  return expressCheckoutSecurityHeaders({
    pathname,
    enabled,
    development,
    identityOrigins: IDENTITY,
    imageOrigins: IMAGE_HOSTS,
  }).find((header) => header.key === "Content-Security-Policy")?.value;
}

describe("express checkout security headers", () => {
  it("applies only to the basket and Details", () => {
    expect(isExpressCheckoutPath("/basket")).toBe(true);
    expect(isExpressCheckoutPath("/checkout")).toBe(true);
    expect(isExpressCheckoutPath("/checkout/")).toBe(true);
    for (const path of [
      "/",
      "/checkout/confirmation",
      "/checkout/cancel",
      "/basket-help",
      "/artworks/a-print",
      "/account",
      "/orders/123",
    ]) {
      expect(isExpressCheckoutPath(path)).toBe(false);
      expect(csp(path)).toBeUndefined();
    }
  });

  it("adds nothing while SHOP_EXPRESS_CHECKOUT is off", () => {
    expect(csp("/basket", false)).toBeUndefined();
    expect(csp("/checkout", false)).toBeUndefined();
  });

  it("allows Stripe.js, its frames and its API on both pages when on", () => {
    for (const path of ["/basket", "/checkout"]) {
      const policy = csp(path) ?? "";
      expect(policy).toContain(
        "script-src 'self' 'unsafe-inline' https://js.stripe.com https://*.js.stripe.com;",
      );
      expect(policy).toContain(
        "frame-src 'self' https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com https://link.com https://*.link.com;",
      );
      expect(policy).toContain(
        "connect-src 'self' https://identity.lax.bid https://api.stripe.com https://link.com https://*.link.com;",
      );
      expect(policy).toContain("https://*.stripe.com https://*.link.com;");
    }
  });

  it("keeps framing, plugins and base URLs locked down", () => {
    const policy = csp("/basket") ?? "";
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
  });

  it("allows only app origins and Stripe's documented sources", () => {
    const policy = csp("/checkout") ?? "";
    for (const directive of policy.split("; ")) {
      const [, ...sources] = directive.split(" ");
      for (const source of sources) {
        expect(
          ALLOWED_KEYWORDS.has(source) || ALLOWED_SOURCES.has(source),
          `unexpected source ${source} in "${directive}"`,
        ).toBe(true);
      }
    }
  });

  it("allows eval and hot-reload sockets in development only", () => {
    expect(csp("/basket")).not.toContain("unsafe-eval");
    expect(csp("/basket")).not.toContain("ws:");
    const dev = expressCheckoutContentSecurityPolicy({ development: true, identityOrigins: [] });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("connect-src 'self' ws: wss: https://api.stripe.com");
  });

  it("reduces configured URLs to unique http(s) origins", () => {
    expect(
      originsOf([
        "https://identity.lax.bid/",
        "https://identity.lax.bid/fedcm",
        "http://localhost:3010",
        undefined,
        "",
        "not a url",
        "javascript:alert(1)",
      ]),
    ).toEqual(["https://identity.lax.bid", "http://localhost:3010"]);
  });
});
