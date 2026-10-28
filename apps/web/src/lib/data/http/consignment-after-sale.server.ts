import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { safeReadData } from "@/lib/data/http/envelope";
import {
  consignmentMoveOptionsSchema,
  sellerAfterSaleSchema,
  staffAfterSaleSchema,
} from "@/lib/seller/consignment-after-sale-parse";
import type {
  ConsignmentMoveOptions,
  SellerAfterSaleView,
  StaffAfterSaleView,
} from "@auction/types";

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
