import { safeReturnTo } from "@/lib/safe-return-to";
import { LAX_ACCOUNT_LOGIN_COOKIE } from "@/lib/session-cookie";
import { getLaxAccountContainer } from "@/server/container";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const { authorizeUrl, pending } = container.startAccountLogin({
    config: container.config,
    returnTo,
  });
  const cookieStore = await cookies();
  cookieStore.set(LAX_ACCOUNT_LOGIN_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: container.cookies.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl);
}
