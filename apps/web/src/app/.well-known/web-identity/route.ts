import { bffConfig } from "@/lib/bff/config.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** FedCM provider manifest pointer (Chromium). Identity serves `/fedcm/config.json`. */
export async function GET() {
  if (process.env.FEDCM_ENABLED !== "true") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const issuer = bffConfig().issuer.replace(/\/+$/, "");
  return NextResponse.json({
    provider_urls: [`${issuer}/fedcm/config.json`],
  });
}
