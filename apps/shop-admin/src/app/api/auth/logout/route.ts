import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SHOP_ADMIN_CSRF_COOKIE, SHOP_ADMIN_SESSION_COOKIE } from "../../../../lib/session-cookie";
import { getShopAdminContainer } from "../../../../server/container";

function wantsJsonResponse(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("application/json")) return true;
  const mode = request.headers.get("sec-fetch-mode");
  return mode === "cors" || mode === "same-origin";
}

export async function POST(request: Request): Promise<Response> {
  const container = getShopAdminContainer();
  if (request.headers.get("origin") !== container.config.publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SHOP_ADMIN_SESSION_COOKIE)?.value ?? null;
  const result = await container.endStaffSession({
    config: container.config,
    sessions: container.sessions,
    sessionId,
  });
  cookieStore.delete(SHOP_ADMIN_SESSION_COOKIE);
  cookieStore.delete(SHOP_ADMIN_CSRF_COOKIE);
  if (wantsJsonResponse(request)) {
    const response = NextResponse.json({ redirectTo: result.redirectTo });
    response.headers.set("cache-control", "no-store");
    return response;
  }
  return NextResponse.redirect(result.redirectTo, 303);
}
