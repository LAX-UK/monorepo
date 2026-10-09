import { safeReturnTo } from "@/lib/safe-return-to";
import {
  SHOP_ADMIN_CSRF_COOKIE,
  SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE,
  SHOP_ADMIN_SESSION_COOKIE,
} from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getShopAdminContainer } from "../../../../server/container";

export async function GET(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  const publicOrigin = container.config.publicOrigin;
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const reason = url.searchParams.get("reason");
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
  if (sessionId) {
    await container.sessions.delete(sessionId);
  }
  const hadLoginAttempt = Boolean(cookieStore.get(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE)?.value);

  const response =
    reason === "not_authorized" || hadLoginAttempt
      ? NextResponse.redirect(new URL("/login?error=not_authorized", publicOrigin))
      : NextResponse.redirect(
          new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, publicOrigin),
        );

  response.cookies.delete(SHOP_ADMIN_SESSION_COOKIE);
  response.cookies.delete(SHOP_ADMIN_CSRF_COOKIE);
  response.cookies.delete(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE);
  return response;
}
