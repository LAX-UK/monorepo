import { unsubscribeReleaseAlerts } from "@/lib/shop-release-alerts.server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The link in every release alert email.
 *
 * - GET (a person clicking): goes to the stop page. Nothing changes on GET, because mail
 *   scanners open links before people do.
 * - POST (one-click unsubscribe from the mail app, RFC 8058): stops the alerts straight away.
 */
export function GET(request: NextRequest) {
  const target = new URL("/release-alerts/stop", request.nextUrl);
  const token = request.nextUrl.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await unsubscribeReleaseAlerts(token);
  if (result.status === "invalid") {
    return new NextResponse("This unsubscribe link is not valid.", { status: 404 });
  }
  if (result.status === "failed") {
    return new NextResponse("Try again in a moment.", { status: 503 });
  }
  return new NextResponse("Release alerts stopped.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
