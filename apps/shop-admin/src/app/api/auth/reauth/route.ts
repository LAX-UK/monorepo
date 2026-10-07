import { safeReturnTo } from "@/lib/safe-return-to";
import { SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "@/lib/session-cookie";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const reason = url.searchParams.get("reason");
  const cookieStore = await cookies();
  const hadLoginAttempt = Boolean(cookieStore.get(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE)?.value);

  const response =
    reason === "not_authorized" || hadLoginAttempt
      ? NextResponse.redirect(new URL("/login?error=not_authorized", request.url))
      : NextResponse.redirect(
          new URL(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`, request.url),
        );

  response.cookies.delete(SHOP_ADMIN_SESSION_COOKIE);
  response.cookies.delete(SHOP_ADMIN_LOGIN_ATTEMPT_COOKIE);
  return response;
}
