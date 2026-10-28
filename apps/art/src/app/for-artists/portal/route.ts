import { laxAccountUrl } from "@/lib/lax-account-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The artist portal's address in emails: lax.art hands the artist to the artworks page of the
 * Selling area in LAX Account, wherever this environment's LAX Account lives.
 */
export function GET() {
  return NextResponse.redirect(laxAccountUrl("sellingArtworks"), 307);
}
