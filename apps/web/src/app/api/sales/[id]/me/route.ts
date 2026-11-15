import { loadSaleViewer } from "@/lib/marketing/load-sale-viewer.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Personal: never stored by the browser cache, a CDN or a shared proxy. */
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/**
 * The parts of a public sale page that belong to the caller (CO-7): following, watched lots,
 * registrations, KYC, telephone booking. Only the caller's own data; signed out gets the signed-out
 * shape; a sale the caller may not see is a 404, as the page is.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadSaleViewer(id);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: PRIVATE });
  }
  return NextResponse.json({ data: result.viewer }, { headers: PRIVATE });
}
