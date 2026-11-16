import {
  engineStopTokenForEditionLink,
  unsubscribeEditionAlerts,
} from "@/lib/shop-edition-alerts.server";
import { type NextRequest, NextResponse } from "next/server";

/**
 * The link in every edition alert email sent before back in stock moved onto the alert engine.
 *
 * - GET (a person clicking): goes to the confirmation page. Nothing changes on GET, because mail
 *   scanners open links before people do.
 * - POST (one-click unsubscribe from the mail app, RFC 8058): stops the alerts straight away.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  // Emails sent before back in stock moved onto the alert engine carry this address. It now
  // leads to the shared stop page; where the old link cannot be moved, its own page still works.
  const engineToken = token ? await engineStopTokenForEditionLink(token) : null;
  const target = new URL(engineToken ? "/release-alerts/stop" : "/alerts/stop", request.nextUrl);
  const forward = engineToken ?? token;
  if (forward) target.searchParams.set("token", forward);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const result = await unsubscribeEditionAlerts(token);
  if (result.status === "invalid") {
    return new NextResponse("This unsubscribe link is not valid.", { status: 404 });
  }
  if (result.status === "failed") {
    return new NextResponse("Try again in a moment.", { status: 503 });
  }
  return new NextResponse("Edition alerts stopped.", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
