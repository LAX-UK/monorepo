import { bffConfig } from "@/lib/bff/config.server";
import { ensureBffRedisConnected, getBffRedis } from "@/lib/bff/redis.server";
import { BidBffSessionStore } from "@/lib/bff/session-store.server";
import {
  BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS,
  SOCKET_REVOCATION_CHANNEL_V1,
  type SocketRevocationPayloadV1,
  verifyBackchannelLogoutToken,
} from "@auction/identity-contracts";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!(request.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded")) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const params = new URLSearchParams(await request.text());
  if (params.getAll("logout_token").length !== 1) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const token = params.get("logout_token");
  if (!token) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const config = bffConfig();
  try {
    const claims = await verifyBackchannelLogoutToken({
      token,
      jwksUrl: `${config.internalIssuer}/.well-known/jwks.json`,
      issuer: config.issuer,
      audience: config.clientId,
    });
    if (!claims) throw new Error("Invalid logout token");
    const redis = await ensureBffRedisConnected(getBffRedis());
    const accepted = await redis.set(
      `bid:bff:logout-jti:${claims.jti}`,
      "1",
      "EX",
      BACKCHANNEL_LOGOUT_MAX_AGE_SECONDS,
      "NX",
    );
    if (accepted !== "OK") {
      return NextResponse.json({ error: "logout_token_replay" }, { status: 400 });
    }
    await new BidBffSessionStore(redis).invalidateBySidOrSubject({
      ...(claims.sid ? { sid: claims.sid } : {}),
      ...(claims.sub ? { sub: claims.sub } : {}),
    });
    const revocation: SocketRevocationPayloadV1 = {
      version: 1,
      reason: "backchannel_logout",
      ...(claims.sid ? { sid: claims.sid } : {}),
      ...(claims.sub ? { subject: claims.sub } : {}),
    };
    await redis.publish(SOCKET_REVOCATION_CHANNEL_V1, JSON.stringify(revocation));
    return new NextResponse(null, { status: 200 });
  } catch {
    return NextResponse.json({ error: "invalid_logout_token" }, { status: 400 });
  }
}
