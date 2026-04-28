import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const callbackUrl = req.nextUrl.toString();
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.redirect(
      new URL("/admin/integrations/xero?error=missing_state", req.nextUrl.origin),
    );
  }

  const res = await authedServerFetch("/admin/integrations/xero/oauth/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, callbackUrl }),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    return NextResponse.redirect(
      new URL(`/admin/integrations/xero?error=${encodeURIComponent(msg)}`, req.nextUrl.origin),
    );
  }

  return NextResponse.redirect(new URL("/admin/integrations/xero?connected=1", req.nextUrl.origin));
}
