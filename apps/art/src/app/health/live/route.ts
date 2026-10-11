import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "art",
    status: "ok",
    release: process.env.SENTRY_RELEASE ?? "unknown",
  });
}
