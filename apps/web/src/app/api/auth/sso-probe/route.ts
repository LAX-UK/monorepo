import { isSafeNextPath } from "@/lib/auth/post-auth-destination";
import { redirectIfSilentProbeBlocked } from "@/lib/auth/silent-sign-in/sso-probe-guard.server";
import { startBidAuthorization } from "@/lib/bff/start-bid-authorization.server";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestedNext = request.nextUrl.searchParams.get("next");
  const nextPath = requestedNext && isSafeNextPath(requestedNext) ? requestedNext : "/dashboard";
  const blocked = redirectIfSilentProbeBlocked(request, nextPath);
  if (blocked) {
    return blocked;
  }
  return startBidAuthorization({
    request,
    nextPath,
    entryIntent: "silent",
    prompt: "none",
  });
}
