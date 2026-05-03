import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({ status: "ok", service: "auction-web" });
}
