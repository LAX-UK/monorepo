import { randomBytes } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { applyHostedAuthCspNonceToResponse } from "../lib/apply-hosted-auth-csp-nonce.js";

/** Hono context key for per-request hosted-auth CSP nonces (Cloudflare JS Detections). */
export const HOSTED_AUTH_CSP_NONCE_KEY = "hostedAuthCspNonce";

function hostedAuthCspNonce(): string {
  return randomBytes(16).toString("base64");
}

function scriptSrcWithNonce(base: string, nonce: string): string {
  return base.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`);
}

/** JSON/API responses — no document execution surface. */
export const AUTH_API_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

/** Hosted login/consent HTML: self scripts, stylesheet, fonts and lockups. */
export const AUTH_HOSTED_HTML_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

/** Hosted HTML when Turnstile widgets are configured. */
export const AUTH_HOSTED_HTML_CSP_TURNSTILE = [
  "default-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export function hostedHtmlCsp(turnstileEnabled: boolean, cspNonce?: string): string {
  const base = turnstileEnabled ? AUTH_HOSTED_HTML_CSP_TURNSTILE : AUTH_HOSTED_HTML_CSP;
  if (!cspNonce) return base;
  return scriptSrcWithNonce(base, cspNonce);
}

/** Baseline security headers for the auth issuer. */
export function createSecurityHeadersMiddleware(options?: { turnstileEnabled?: boolean }) {
  return createMiddleware(async (c, next) => {
    const cspNonce = hostedAuthCspNonce();
    c.set(HOSTED_AUTH_CSP_NONCE_KEY, cspNonce);
    await next();
    c.res = await applyHostedAuthCspNonceToResponse(c.res, cspNonce);
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    const isHtml = (c.res.headers.get("content-type") ?? "").includes("text/html");
    c.header(
      "Content-Security-Policy",
      isHtml ? hostedHtmlCsp(Boolean(options?.turnstileEnabled), cspNonce) : AUTH_API_CSP,
    );
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (c.req.header("x-forwarded-proto") === "https" || c.req.url.startsWith("https:")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
  });
}
