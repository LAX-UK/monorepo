import { xeroCallbackErrorCodeForStatus } from "@/lib/admin/finance/xero-callback-error";
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
    // The API's error text stays out of the redirect; the page shows a sentence for the code.
    return NextResponse.redirect(
      adminXeroUrl(`/admin/integrations/xero?error=${xeroCallbackErrorCodeForStatus(res.status)}`),
    );
  }

  return NextResponse.redirect(adminXeroUrl("/admin/integrations/xero?connected=1"));
}
