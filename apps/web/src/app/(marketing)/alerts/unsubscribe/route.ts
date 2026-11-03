import { stopAlertsOneClick } from "@/lib/data/http/alerts.server";
import { NextResponse } from "next/server";

/**
 * The address in every alert email and its List-Unsubscribe header. Opening it never changes
 * anything: a GET goes to the stop page, where a button does. A mail app's one-click button POSTs
 * here (RFC 8058) and every alert topic for the address stops, with no page and no sign-in.
 */
export function GET(req: Request) {
  const target = new URL("/alerts/stop", req.url);
  const token = new URL(req.url).searchParams.get("t");
  if (token) target.searchParams.set("t", token);
  return NextResponse.redirect(target, 303);
}

export async function POST(req: Request) {
  const fromQuery = new URL(req.url).searchParams.get("t");
  const form = fromQuery ? null : await req.formData().catch(() => null);
  const fromForm = form?.get("t");
  const token = fromQuery ?? (typeof fromForm === "string" ? fromForm : null);
  if (!token) return new NextResponse("Missing unsubscribe link", { status: 400 });
  const stopped = await stopAlertsOneClick(token);
  return stopped
    ? new NextResponse("Unsubscribed", { status: 200, headers: { "content-type": "text/plain" } })
    : new NextResponse("Invalid unsubscribe link", { status: 400 });
}
