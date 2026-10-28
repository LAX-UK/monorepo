import { loadArtEnv, loadArtStorefrontBaseUrl } from "@/env.server";
import { ART_REQUEST_PATH_HEADER } from "@/lib/request-path-header";
import {
  X_ROBOTS_TAG_NOINDEX,
  isArtIndexingAllowedForHost,
  publicRequestHost,
} from "@/lib/seo/art-indexing";
import { resolveLegacyRedirect } from "@/lib/seo/legacy-redirects";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const resolution = resolveLegacyRedirect(request.nextUrl, loadArtStorefrontBaseUrl);
  if (resolution?.kind === "redirect") {
    return NextResponse.redirect(resolution.location, 301);
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
