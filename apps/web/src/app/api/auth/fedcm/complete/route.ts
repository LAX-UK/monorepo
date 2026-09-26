import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Exchange FedCM assertion token for a BFF session (Chromium, flag-gated). */
export async function POST() {
  if (process.env.FEDCM_ENABLED !== "true") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  return NextResponse.json({ error: "not_implemented" }, { status: 501 });
}
