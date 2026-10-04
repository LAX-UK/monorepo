import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SHOP_ADMIN_LOGIN_COOKIE } from "../../../../lib/session-cookie";
import { getShopAdminContainer } from "../../../../server/container";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo")?.trim() || "/";
  const container = getShopAdminContainer();
  const { authorizeUrl, pending } = container.startStaffLogin({
    config: container.config,
    returnTo,
  });
  const cookieStore = await cookies();
  cookieStore.set(SHOP_ADMIN_LOGIN_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: container.config.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl);
}
