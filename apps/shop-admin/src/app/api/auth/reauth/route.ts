import { safeReturnTo } from "@/lib/safe-return-to";
import {
  SHOP_ADMIN_CSRF_COOKIE,
  SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE,
  shopAdminSessionCookie,
} from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getShopAdminContainer } from "../../../../server/container";

/**
 * Ends the staff session and signs in again. A POST that checks the request's origin, like
 * logout and switch-account, so a link on another site cannot sign staff out.
 */
export async function POST(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  const publicOrigin = container.config.publicOrigin;
  if (request.headers.get("origin") !== publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const reason = url.searchParams.get("reason");
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(shopAdminSessionCookie(container.config))?.value ?? null;
  if (sessionId) {
    await container.sessions.delete(sessionId);
  }
  const hadLoginAttempt = Boolean(cookieStore.get(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE)?.value);

  const response =
    reason === "not_authorized" || hadLoginAttempt
      ? NextResponse.redirect(new URL("/login?error=not_authorized", publicOrigin), 303)
      : NextResponse.redirect(
          new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, publicOrigin),
          303,
        );

  response.cookies.delete(shopAdminSessionCookie(container.config));
  response.cookies.delete(SHOP_ADMIN_CSRF_COOKIE);
  response.cookies.delete(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE);
  return response;
}
