import { resolvePublicOriginUrl } from "@/lib/bff/public-origin-url.server";
import { fetchLegalEntityPayoutStatementPdf } from "@/lib/data/http/payout-statement-proxy.server";
import { payoutStatementUnavailableHref } from "@/lib/seller/payout-statement-links";
import { NextResponse } from "next/server";

/**
 * Proxies to the API PDF route so dashboard URLs match
 * `/legal-entities/:id/payouts/:payoutId/statement` while auth stays cookie-based. The PDF is
 * served by the redirect the API answers with; anything else sends the person to the designed
 * error page (Try again, contact client services) rather than showing raw JSON.
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

  return NextResponse.redirect(
    resolvePublicOriginUrl(payoutStatementUnavailableHref(legalEntityId, payoutId)),
    303,
  );
}
