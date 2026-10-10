import { safeReturnTo } from "@/lib/safe-return-to";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SHOP_ADMIN_CSRF_COOKIE,
  SHOP_ADMIN_LOGIN_COOKIE,
  SHOP_ADMIN_LOGIN_RETRY_COOKIE,
  SHOP_ADMIN_SESSION_COOKIE,
} from "../../../../lib/session-cookie";
import { getShopAdminContainer } from "../../../../server/container";

/** Clears local staff session and starts a fresh IdP login (switch LAX account). */
export async function POST(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  if (request.headers.get("origin") !== container.config.publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"), "/");
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
  cookieStore.delete(SHOP_ADMIN_LOGIN_COOKIE);
  cookieStore.delete(SHOP_ADMIN_LOGIN_RETRY_COOKIE);
  cookieStore.delete(SHOP_ADMIN_CSRF_COOKIE);
  if (sessionId) {
    await container.sessions.delete(sessionId);
    cookieStore.delete(SHOP_ADMIN_SESSION_COOKIE);
  }
  const { authorizeUrl, pending } = container.startStaffLogin({
    config: container.config,
    returnTo,
    prompt: "login",
  });
  cookieStore.set(SHOP_ADMIN_LOGIN_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: container.config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl, 303);
}
