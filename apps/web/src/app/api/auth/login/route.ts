import { startBidAuthorization } from "@/lib/bff/start-bid-authorization.server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return startBidAuthorization({ request });
}
