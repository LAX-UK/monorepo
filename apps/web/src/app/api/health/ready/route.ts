import { probeIdentityDependency } from "@/lib/bff/identity-health.server";
import { ensureBffRedisConnected, getBffRedis } from "@/lib/bff/redis.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REDIS_PING_TIMEOUT_MS = 3_000;

async function pingRedisWithTimeout(): Promise<void> {
  const redis = await ensureBffRedisConnected(getBffRedis());
  await Promise.race([
    redis.ping(),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Redis ping timed out")), REDIS_PING_TIMEOUT_MS);
    }),
  ]);
}

export async function GET() {
  try {
    await pingRedisWithTimeout();
  } catch {
    return NextResponse.json(
      {
        service: "auction-web",
        status: "unavailable",
        release: process.env.SENTRY_RELEASE ?? "unknown",
      },
      { status: 503 },
    );
  }

  const identity = await probeIdentityDependency();

  return NextResponse.json({
    service: "auction-web",
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
    dependencies: {
      identity: { status: identity },
      redis: { status: "ok" as const },
    },
  });
}
