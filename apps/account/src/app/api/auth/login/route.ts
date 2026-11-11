import { safeReturnTo } from "@/lib/safe-return-to";
import { LAX_ACCOUNT_LOGIN_COOKIE } from "@/lib/session-cookie";
import { getLaxAccountContainer } from "@/server/container";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

async function signedInSubject(
  container: ReturnType<typeof getLaxAccountContainer>,
  sessionId: string | undefined,
): Promise<string | null> {
  if (!sessionId) return null;
  try {
    return (await container.sessions.get(sessionId))?.subject ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  const url = new URL(request.url);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const cookieStore = await cookies();
  // A step-up is for the person signed in here now; its subject is what the sign-in must return.
  const reauthSubject =
    url.searchParams.get("intent") === "reauth"
      ? await signedInSubject(container, cookieStore.get(container.cookies.sessionCookie)?.value)
      : null;
  const { authorizeUrl, pending } = container.startAccountLogin({
    config: container.config,
    returnTo,
    ...(reauthSubject ? { reauth: { subject: reauthSubject } } : {}),
  });
  cookieStore.set(LAX_ACCOUNT_LOGIN_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: container.cookies.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(authorizeUrl);
}
