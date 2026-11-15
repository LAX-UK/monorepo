import { loadLotViewer } from "@/lib/marketing/load-lot-viewer.server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Personal: never stored by the browser cache, a CDN or a shared proxy. */
const PRIVATE = { "Cache-Control": "private, no-store", Vary: "Cookie" };

/**
 * The parts of a public lot page that belong to the caller (CO-7): watching, the bid gate (KYC,
 * registration, the account bidding), own lot, the condition report request, the account
 * restore. Only the caller's own data; signed out gets the signed-out shape; a lot the caller may
 * not see is a 404, as the page is. The live bid state is not here: it comes from the socket.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadLotViewer(id);
  if (result.kind === "not_found") {
    return NextResponse.json({ error: "not_found" }, { status: 404, headers: PRIVATE });
  }
  return NextResponse.json({ data: result.viewer }, { headers: PRIVATE });
}
