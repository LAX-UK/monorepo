import { fetchLegalEntityPayoutStatementPdf } from "@/lib/data/http/payout-statement-proxy.server";
import { NextResponse } from "next/server";

/** Proxies to the API PDF route so dashboard URLs match
 * `/dashboard/legal-entities/:id/payouts/:payoutId/statement` while auth stays cookie-based.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ legalEntityId: string; payoutId: string }> },
) {
  const { legalEntityId, payoutId } = await context.params;
  const res = await fetchLegalEntityPayoutStatementPdf(legalEntityId, payoutId);

  if (res.status === 301 || res.status === 302) {
    const loc = res.headers.get("location");
    if (loc) {
      return NextResponse.redirect(loc, res.status);
    }
  }

  if (res.status === 503) {
    return NextResponse.json(
      { error: "statement_pending" },
      { status: 503, headers: { "Retry-After": res.headers.get("retry-after") ?? "5" } },
    );
  }

  if (res.status === 422) {
    const body = (await res.json().catch(() => ({}))) as { detail?: string };
    return NextResponse.json(
      { error: "statement_generation_failed", detail: body.detail },
      { status: 422 },
    );
  }

  if (!res.ok) {
    return NextResponse.json(
      { error: "statement_fetch_failed", status: res.status },
      { status: res.status },
    );
  }

  return NextResponse.json({ error: "unexpected_statement_response" }, { status: 502 });
}
