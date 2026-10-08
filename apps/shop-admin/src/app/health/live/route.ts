import { NextResponse } from "next/server";

/** Liveness only — no Shop API or OIDC config (safe during platform rollouts). */
export function GET(): Response {
  return NextResponse.json({
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
  });
}
