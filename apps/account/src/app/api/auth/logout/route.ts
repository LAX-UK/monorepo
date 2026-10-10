import { getLaxAccountContainer } from "@/server/container";
import { buildEndSessionUrl } from "@auction/identity-rp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  const container = getLaxAccountContainer();
  if (request.headers.get("origin") !== container.config.publicOrigin) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const { secure, sessionCookie } = container.cookies;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(sessionCookie)?.value ?? null;
  let idToken: string | undefined;
  if (sessionId) {
    const record = await container.sessions.get(sessionId);
    idToken = record?.idToken;
    await container.sessions.delete(sessionId);
    // `__Host-` cookies are only cleared by a Set-Cookie that repeats Secure and Path=/.
    cookieStore.set(sessionCookie, "", {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  const landing = `${container.config.publicOrigin}/`;
  if (!idToken) return NextResponse.redirect(landing, 303);
  const redirectTo = buildEndSessionUrl({
    endSessionEndpoint: `${container.config.oidcIssuer}/api/auth/oauth2/endsession`,
    clientId: container.config.oidcClientId,
    postLogoutRedirectUri: landing,
    idTokenHint: idToken,
  });
  return NextResponse.redirect(redirectTo, 303);
}
