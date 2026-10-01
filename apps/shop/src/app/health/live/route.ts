import { NextResponse } from "next/server";

/** Liveness only — no BFF or identity provider checks (safe during platform rollouts). */
export function GET() {
  return NextResponse.json({
    service: "shop",
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
  });
}
