import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";

/** Proxies `GET …/statement.pdf` with cookie auth (path carries `legalEntityId`). */
export async function fetchLegalEntityPayoutStatementPdf(
  legalEntityId: string,
  payoutId: string,
): Promise<Response> {
  return authedServerFetch(
    `/legal-entities/${encodeURIComponent(legalEntityId)}/payouts/${encodeURIComponent(payoutId)}/statement.pdf`,
    { redirect: "manual", cache: "no-store" },
  );
}
