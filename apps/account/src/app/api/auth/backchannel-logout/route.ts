import { getLaxAccountContainer } from "@/server/container";
import {
  BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS,
  verifyBackchannelLogoutToken,
} from "@auction/identity-contracts";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const params = new URLSearchParams(await request.text());
  if (params.getAll("logout_token").length !== 1) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const token = params.get("logout_token");
  if (!token) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const container = getLaxAccountContainer();
  const claims = await verifyBackchannelLogoutToken({
    token,
    jwksUrl: `${container.config.oidcInternalIssuer}/.well-known/jwks.json`,
    issuer: container.config.oidcIssuer,
    audience: container.config.oidcClientId,
  }).catch(() => null);
  if (!claims) return NextResponse.json({ error: "invalid_logout_token" }, { status: 400 });

  let accepted: boolean;
  try {
    accepted = await container.sessions.claimBackchannelLogoutJti(
      claims.jti,
      BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS,
    );
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
  if (!accepted) {
    return NextResponse.json({ error: "logout_token_replay" }, { status: 400 });
  }
  try {
    await container.sessions.invalidateBySidOrSubject({
      ...(claims.sid ? { sid: claims.sid } : {}),
      ...(claims.sub ? { sub: claims.sub } : {}),
    });
  } catch {
    await container.sessions.releaseBackchannelLogoutJti(claims.jti).catch(() => undefined);
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
  return new NextResponse(null, { status: 200 });
}
