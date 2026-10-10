import { getLaxAccountContainer } from "@/server/container";
import { accountLiveHealthBody } from "@/server/operational-health";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const container = getLaxAccountContainer();
  const redisStatus = (await container.sessions.isReachable()) ? "ok" : "error";
  const ok = redisStatus === "ok";
  return NextResponse.json(
    {
      ...accountLiveHealthBody(),
      status: ok ? "ok" : "degraded",
      dependencies: { redis: { status: redisStatus } },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
