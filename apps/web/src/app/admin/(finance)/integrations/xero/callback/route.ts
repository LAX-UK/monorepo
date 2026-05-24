import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeXeroCallbackUrl } from "@auction/validators";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function adminXeroUrl(path: string): URL {
  return new URL(path, getSiteUrl());
}

export async function GET(req: NextRequest) {
  const callbackUrl = normalizeXeroCallbackUrl(req.nextUrl.toString(), getSiteUrl());
  const state = req.nextUrl.searchParams.get("state");
  if (!state) {
    return NextResponse.redirect(adminXeroUrl("/admin/integrations/xero?error=missing_state"));
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
      adminXeroUrl(`/admin/integrations/xero?error=${encodeURIComponent(msg)}`),
    );
  }

  return NextResponse.redirect(adminXeroUrl("/admin/integrations/xero?connected=1"));
}
