import { clearOnboardingInviteCookie } from "@/lib/bff/onboarding-invite-cookie.server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clears the short-lived HttpOnly invite token after onboarding succeeds. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearOnboardingInviteCookie(response);
  response.headers.set("cache-control", "no-store");
  return response;
}
