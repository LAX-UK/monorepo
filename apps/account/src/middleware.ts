import { ORIGIN_PRODUCT_COOKIE, detectOriginProduct } from "@/lib/origin-product";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const envUrl = (value: string | undefined) => value?.trim().replace(/\/+$/, "") || undefined;

/**
 * Remembers which LAX product the visitor came from, for the length of the browser session, so
 * the header can offer a way back. The cookie holds a product id and nothing else. It runs on the
 * Edge runtime, so it reads the product URLs from the environment and imports only pure modules.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const product = detectOriginProduct(
    {
      from: request.nextUrl.searchParams.get("from"),
      referrer: request.headers.get("referer"),
    },
    {
      bid: envUrl(process.env.LAX_BID_PUBLIC_URL),
      shop: envUrl(process.env.LAX_SHOP_PUBLIC_URL),
      art: envUrl(process.env.LAX_ART_PUBLIC_URL),
    },
  );
  if (product) {
    response.cookies.set(ORIGIN_PRODUCT_COOKIE, product, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}

export const config = { matcher: ["/account/:path*"] };
