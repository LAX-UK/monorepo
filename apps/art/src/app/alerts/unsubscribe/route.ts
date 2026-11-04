import { stopAlerts } from "@/lib/alerts/art-email-alerts.server";
import { type NextRequest, NextResponse } from "next/server";

const TEXT = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

/**
 * The stop link in every lax.art email.
 *
 * - GET (a person clicking): goes to the stop page. Nothing changes on GET, because mail
 *   scanners open links before people do.
 * - POST from the mail app (RFC 8058 one-click unsubscribe): stops the emails straight away.
 * - POST from the stop page's button, marked `from=page`: stops them and returns to the page.
 */
export function GET(request: NextRequest) {
  const target = new URL("/alerts/stop", request.nextUrl);
  const token = request.nextUrl.searchParams.get("token");
  if (token) target.searchParams.set("token", token);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const form = await request.formData().catch(() => null);
  const fromPage = form?.get("from") === "page";
  const result = await stopAlerts(token);

  if (fromPage) {
    const target = new URL("/alerts/stop", request.nextUrl);
    target.searchParams.set("token", token);
    target.searchParams.set("result", result.status === "ok" ? "stopped" : result.status);
    return NextResponse.redirect(target, 303);
  }
  if (result.status === "invalid") {
    return new NextResponse("This unsubscribe link is not valid.", { status: 404, headers: TEXT });
  }
  if (result.status === "failed") {
    return new NextResponse("Try again in a moment.", { status: 503, headers: TEXT });
  }
  return new NextResponse("Emails stopped.", { status: 200, headers: TEXT });
}
