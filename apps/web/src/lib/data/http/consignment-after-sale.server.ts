import "server-only";

import { throwIfNotOk } from "@/lib/dashboard/dashboard-fetch-errors";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readJsonBody, readListEnvelope, safeReadData } from "@/lib/data/http/envelope";
import type { ListPage } from "@/lib/data/paging/read-all-pages";
import {
  consignmentMoveOptionsSchema,
  sellerAfterSaleSchema,
  staffAfterSaleSchema,
} from "@/lib/seller/consignment-after-sale-parse";
import type {
  ConsignmentMoveOptions,
  SellerAfterSaleView,
  SellerUnsoldOutcome,
  StaffAfterSaleView,
} from "@auction/types";
import { z } from "zod";

const path = (submissionId: string, rest: string) =>
  `/submissions/${encodeURIComponent(submissionId)}/${rest}`;

const STAFF = { skipActingLegalEntityHeader: true } as const;

/** What the seller may do with a consignment after handing it in; `null` when not theirs. */
export async function getServerConsignmentAfterSale(
  submissionId: string,
): Promise<SellerAfterSaleView | null> {
  const res = await authedServerFetch(path(submissionId, "after-sale"));
  return safeReadData(res, sellerAfterSaleSchema);
}

const unsoldOutcomeSchema = z.object({
  lotId: z.string(),
  submissionId: z.string(),
  title: z.string(),
  endedAt: z.string(),
  chooseBy: z.string(),
  choice: z.enum(["none", "requested", "confirmed"]),
});

/**
 * One page of the acting account's consigned lots that ended unsold, with what was chosen. The
 * API narrows it to what the member may see (a consignor's own lots) and refuses other roles.
 */
export async function listServerUnsoldOutcomes(page: {
  choice?: SellerUnsoldOutcome["choice"];
  limit: number;
  offset: number;
}): Promise<ListPage<SellerUnsoldOutcome>> {
  const query = new URLSearchParams({ limit: String(page.limit), offset: String(page.offset) });
  if (page.choice) query.set("choice", page.choice);
  const res = await authedServerFetch(`/submissions/mine/unsold-lots?${query}`, {
    cache: "no-store",
  });
  await throwIfNotOk(res, "submissions");
  const body = await readJsonBody(res);
  return readListEnvelope(body, unsoldOutcomeSchema, "GET /submissions/mine/unsold-lots");
}

/** Staff: the unsold choice and withdrawal request on a consignment. */
export async function getAdminConsignmentAfterSale(
  submissionId: string,
): Promise<StaffAfterSaleView | null> {
  const res = await authedServerFetch(path(submissionId, "after-sale/staff"), STAFF);
  return safeReadData(res, staffAfterSaleSchema);
}

/** Staff: the seller's organisations a personal consignment can move to. */
export async function getAdminConsignmentMoveOptions(
  submissionId: string,
): Promise<ConsignmentMoveOptions | null> {
  const res = await authedServerFetch(path(submissionId, "move-options"), STAFF);
  return safeReadData(res, consignmentMoveOptionsSchema);
}
