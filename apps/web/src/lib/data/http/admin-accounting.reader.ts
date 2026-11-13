import "server-only";

import { accountingQueuePageSchema } from "@/lib/data/http/admin-accounting.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData } from "@/lib/data/http/envelope";
import type {
  AccountingOrganisation,
  AccountingQueuePage,
  AccountingQueueTab,
} from "@auction/types";

export type AccountingQueueParams = {
  tab: AccountingQueueTab;
  organisation: AccountingOrganisation | null;
  limit: number;
  offset: number;
};

export function accountingQueryString(params: AccountingQueueParams): string {
  const qs = new URLSearchParams({
    tab: params.tab,
    limit: String(params.limit),
    offset: String(params.offset),
  });
  if (params.organisation) qs.set("organisation", params.organisation);
  return qs.toString();
}

/** One tab of Finance › Accounting with the count of every tab. */
export async function getAccountingQueuePage(
  params: AccountingQueueParams,
): Promise<AccountingQueuePage> {
  const res = await authedServerFetch(`/admin/finance/accounting?${accountingQueryString(params)}`);
  return readData(res, accountingQueuePageSchema, {
    context: "GET /admin/finance/accounting",
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Accounting unavailable: ${status}`),
  });
}
