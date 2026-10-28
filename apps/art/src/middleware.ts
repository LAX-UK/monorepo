import { loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import { shopBaseUrl } from "@/lib/artwork/shop-editions.vm";
import { loadArtCrossProductFooterLinks } from "@/lib/ecosystem/product-directory.server";
import { laxAccountUrl } from "@/lib/lax-account-url";
import { ART_REQUEST_PATH_HEADER } from "@/lib/request-path-header";
import { followRetiredArtRoute, resolveRetiredArtRoute } from "@/lib/routing/retired-art-routes";
import {
  X_ROBOTS_TAG_NOINDEX,
  isArtIndexingAllowedForHost,
  publicRequestHost,
} from "@/lib/seo/art-indexing";
import { resolveLegacyRedirect } from "@/lib/seo/legacy-redirects";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const destinations = {
    laxAccountUrl,
    shopBaseUrl: shopBaseUrl(loadArtCrossProductFooterLinks()),
  };
  const retired = resolveRetiredArtRoute(request.nextUrl.pathname, destinations);
  if (retired) {
    return NextResponse.redirect(new URL(retired, request.url), 308);
  }

  const resolution = resolveLegacyRedirect(request.nextUrl, loadArtStorefrontBaseUrl);
  if (resolution?.kind === "redirect") {
    const location = followRetiredArtRoute(
      resolution.location,
      loadArtStorefrontBaseUrl(),
      destinations,
    );
    return NextResponse.redirect(location, 301);
  }
  if (resolution?.kind === "miss") {
    console.warn(
      JSON.stringify({
        event: "legacy_redirect_miss",
        path: resolution.path,
        referer: request.headers.get("referer"),
        userAgent: request.headers.get("user-agent"),
      }),
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    ART_REQUEST_PATH_HEADER,
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const host = publicRequestHost(request.headers);
  if (!isArtIndexingAllowedForHost(host, loadArtEnv().ART_ALLOW_INDEXING)) {
    response.headers.set("X-Robots-Tag", X_ROBOTS_TAG_NOINDEX);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/|api/|health|favicon|icon|apple-icon).*)"],
};
