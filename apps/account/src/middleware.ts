import { ORIGIN_PRODUCT_COOKIE } from "@/lib/session-cookie";
import { loadLaxAccountConfig } from "@/server/config";
import { detectOriginProduct } from "@/server/domain/origin-product";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Remembers which LAX product the visitor came from, for the length of the browser session, so
 * the header can offer a way back. The cookie holds a product id and nothing else.
 */
export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  let product: ReturnType<typeof detectOriginProduct>;
  try {
    product = detectOriginProduct(
      {
        from: request.nextUrl.searchParams.get("from"),
        referrer: request.headers.get("referer"),
      },
      loadLaxAccountConfig(),
    );
  } catch {
    return response;
  }
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
