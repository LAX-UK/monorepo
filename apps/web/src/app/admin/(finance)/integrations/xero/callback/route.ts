import { xeroCallbackErrorCodeForStatus } from "@/lib/admin/finance/xero-callback-error";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { getSiteUrl } from "@/lib/site-url";
import { normalizeXeroCallbackUrl } from "@auction/validators";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Enough of the API's answer to diagnose a failure without filling the log. */
const LOGGED_DETAIL_LIMIT = 500;

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
    // The API's error text stays out of the redirect; the page shows a sentence for the code.
    // The detail goes to the server log, where staff can read it and a visitor cannot.
    const code = xeroCallbackErrorCodeForStatus(res.status);
    const detail = await res.text().catch(() => "");
    console.error("[xero-callback] connection failed", {
      status: res.status,
      code,
      detail: detail.slice(0, LOGGED_DETAIL_LIMIT),
    });
    return NextResponse.redirect(adminXeroUrl(`/admin/integrations/xero?error=${code}`));
  }

  return NextResponse.redirect(adminXeroUrl("/admin/integrations/xero?connected=1"));
}
