import {
  buildRequestWithAuthEdgeHeader,
  getAuthPublicCookieRedirectUrl,
} from "@/lib/auth/auth-public-edge";
import { purgeStaleAuthCookies } from "@/lib/auth/purge-stale-auth-cookies";
import { THEME_INIT_SNIPPET } from "@/lib/csp/theme-init-snippet";
import { isOrgModuleEnabled } from "@/lib/legal-entity/org-module-enabled";
import { applyClientHintHeaders } from "@/lib/preferences/client-hint-headers";
import { seedDefaultThemeCookieIfNeeded } from "@/lib/preferences/seed-theme-cookie";
import { X_ROBOTS_TAG_NOINDEX, isIndexingAllowedForHost } from "@/lib/seo/is-indexing-allowed";
import { resolveRequestHostname } from "@/lib/seo/request-hostname";
import { syncClientWorkspaceCookie } from "@/lib/workspace/sync-client-workspace-cookie";
import { type NextRequest, NextResponse } from "next/server";

/** Generate a cryptographically random nonce string for CSP. */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/** CSP `script-src` token for the inline theme-init script (matches {@link THEME_INIT_SNIPPET}). */
const themeInitScriptSrcTokenPromise = (async (): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(THEME_INIT_SNIPPET));
  const b64 = uint8ArrayToBase64(new Uint8Array(buf));
  return `'sha256-${b64}'`;
})();

/**
 * Build Content-Security-Policy header value.
 * Set `CSP_ENFORCE=1` to flip from report-only to enforcing.
 */
function buildCsp(nonce: string, themeInitScriptSrcToken: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  // Next.js dev mode (HMR / React Refresh) and Turbopack rely on `eval()`,
  // so we permit `'unsafe-eval'` in development only. Production runs without it.
  // Theme init runs without a nonce (avoids hydration mismatch); allow via static hash.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' ${themeInitScriptSrcToken} https://*.facebook.net https://js.stripe.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${themeInitScriptSrcToken} https://*.facebook.net https://js.stripe.com`;

  const directives = [
    `default-src 'self'`,
    scriptSrc,
    // Inline styles from Next.js emotion / tailwind; adjust as needed.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    // Include configured API/auth origins. In local dev these vars are typically
    // absent so we fall back to localhost ports to avoid CSP violations.
    // DigitalOcean Spaces presigned PUTs go directly to *.digitaloceanspaces.com
    `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"} ${process.env.NEXT_PUBLIC_AUTH_URL ?? "http://localhost:3001"} ${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002"} https://*.digitaloceanspaces.com https://challenges.cloudflare.com https://www.googletagmanager.com https://gtm.lax.bid https://*.google-analytics.com https://*.analytics.google.com https://*.g.doubleclick.net https://stats.g.doubleclick.net https://*.facebook.com https://*.facebook.net https://*.veriff.com https://*.veriff.me https://*.probity.io https://api.stripe.com https://m.stripe.network https://r.stripe.com`.trim(),
    // Cloudflare Turnstile + YouTube + Veriff + Stripe Connect embedded components.
    "frame-src https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://*.veriff.com https://*.veriff.me https://*.hotjar.com https://js.stripe.com https://hooks.stripe.com",
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    ...(process.env.NEXT_PUBLIC_CSP_REPORT_URI
      ? [`report-uri ${process.env.NEXT_PUBLIC_CSP_REPORT_URI}`]
      : []),
  ];
  return directives.join("; ");
}

const CSP_REPORT_ONLY = process.env.CSP_ENFORCE !== "1";

/** Pass pathname + search to server components for org onboarding auth redirects. */
function applyOrgOnboardingPathHeaders(request: NextRequest, reqHeaders: Headers): void {
  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith("/onboarding/organisation")) {
    reqHeaders.set("x-pathname", pathname);
    reqHeaders.set("x-search", search);
  }
}

/** True when the URL is the post-stale-session landing page; we purge the cookies as we render it. */
function isStaleSessionLanding(url: URL): boolean {
  if (url.pathname !== "/login") return false;
  return (
    url.searchParams.get("session_expired") === "1" || url.searchParams.get("auth") === "required"
  );
}

export async function middleware(request: NextRequest) {
  const nonce = generateNonce();
  const themeInitScriptSrcToken = await themeInitScriptSrcTokenPromise;

  // Auth edge header tagging.
  const tagged = buildRequestWithAuthEdgeHeader(request);
  let baseResponse: ReturnType<typeof NextResponse.next> | ReturnType<typeof NextResponse.redirect>;

  if (tagged) {
    applyOrgOnboardingPathHeaders(request, tagged.request.headers);
    const res = NextResponse.next(tagged);
    res.headers.set("x-nonce", nonce);
    baseResponse = res;
  } else {
    const redirectUrl = getAuthPublicCookieRedirectUrl(
      request.nextUrl,
      request.headers.get("cookie") ?? "",
    );
    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl, 307);
    }

    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-nonce", nonce);
    applyOrgOnboardingPathHeaders(request, reqHeaders);
    baseResponse = NextResponse.next({ request: { headers: reqHeaders } });
  }

  if (isStaleSessionLanding(request.nextUrl)) {
    purgeStaleAuthCookies(baseResponse);
  }

  seedDefaultThemeCookieIfNeeded(request, baseResponse);
  syncClientWorkspaceCookie(request, baseResponse);

  const hostname = request.nextUrl.hostname;
  if (!isOrgModuleEnabled(hostname)) {
    const { pathname } = request.nextUrl;
    if (
      pathname === "/onboarding/organisation" ||
      pathname.startsWith("/onboarding/organisation/") ||
      pathname === "/dashboard/invitations" ||
      pathname.startsWith("/dashboard/invitations/") ||
      pathname.startsWith("/dashboard/organisations/")
    ) {
      return NextResponse.redirect(new URL("/dashboard/organisations", request.url), 307);
    }
  }

  const csp = buildCsp(nonce, themeInitScriptSrcToken);
  const headerName = CSP_REPORT_ONLY
    ? "content-security-policy-report-only"
    : "content-security-policy";
  baseResponse.headers.set(headerName, csp);
  baseResponse.headers.set("x-frame-options", "DENY");
  baseResponse.headers.set("x-content-type-options", "nosniff");
  baseResponse.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  // HSTS is a transport-layer control; it must be sent in production regardless
  // of whether CSP is in report-only or enforcing mode.
  if (process.env.NODE_ENV === "production") {
    baseResponse.headers.set(
      "strict-transport-security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  applyClientHintHeaders(baseResponse);

  // Behind Cloudflare / DigitalOcean, `nextUrl.hostname` is the internal origin
  // host, so derive the public host from forwarded headers for the index gate.
  const publicHostname = resolveRequestHostname(request.headers, hostname);
  if (!isIndexingAllowedForHost(publicHostname)) {
    baseResponse.headers.set("X-Robots-Tag", X_ROBOTS_TAG_NOINDEX);
  }

  return baseResponse;
}

/** CSP + security headers on all HTML routes; excludes static assets, Sentry tunnel, QR redirects, and `/api/*` route handlers. */
export const config = {
  matcher: ["/((?!api|q/|sentry-tunnel|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
