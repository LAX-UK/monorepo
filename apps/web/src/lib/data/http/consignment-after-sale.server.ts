import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  parseConsignmentMoveOptions,
  parseSellerAfterSaleView,
  parseStaffAfterSaleView,
} from "@/lib/seller/consignment-after-sale-parse";
import type {
  ConsignmentMoveOptions,
  SellerAfterSaleView,
  StaffAfterSaleView,
} from "@auction/types";

async function readData(res: Response): Promise<unknown> {
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  return body?.data ?? null;
}

const path = (submissionId: string, rest: string) =>
  `/submissions/${encodeURIComponent(submissionId)}/${rest}`;

/** What the seller may do with a consignment after handing it in; `null` when unreadable. */
export async function getServerConsignmentAfterSale(
  submissionId: string,
): Promise<SellerAfterSaleView | null> {
  return parseSellerAfterSaleView(
    await readData(await authedServerFetch(path(submissionId, "after-sale"))),
  );
}

/** Staff: the unsold choice and withdrawal request on a consignment. */
export async function getAdminConsignmentAfterSale(
  submissionId: string,
): Promise<StaffAfterSaleView | null> {
  const res = await authedServerFetch(path(submissionId, "after-sale/staff"), {
    skipActingLegalEntityHeader: true,
  });
  return parseStaffAfterSaleView(await readData(res));
}

/** Staff: the seller's organisations a personal consignment can move to. */
export async function getAdminConsignmentMoveOptions(
  submissionId: string,
): Promise<ConsignmentMoveOptions | null> {
  const res = await authedServerFetch(path(submissionId, "move-options"), {
    skipActingLegalEntityHeader: true,
  });
  return parseConsignmentMoveOptions(await readData(res));
}
