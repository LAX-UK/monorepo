import "server-only";

import { getServerDataContainer } from "@/lib/data/container.server";
import { listServerUnsoldOutcomes } from "@/lib/data/http/consignment-after-sale.server";
import { listServerConsignmentAgreements } from "@/lib/data/http/consignment-agreements.server";
import { getServerNeedsYou } from "@/lib/data/http/needs-you.server";
import { resolveSaleTitles } from "@/lib/data/sale-titles.server";
import {
  type SellerWorkspaceContext,
  sellerCan,
} from "@/lib/legal-entity/seller-acting-context.server";
import { consignedLotScope } from "@auction/domain";
import type {
  ConsignmentAgreement,
  ItemSubmission,
  Lot,
  SellerUnsoldOutcome,
} from "@auction/types";
import {
  type ConsignmentRecord,
  type ConsignmentTasks,
  NO_CONSIGNMENT_TASKS,
  buildConsignmentRecords,
  consignmentTasksFromNeedsYou,
  visibleConsignedLots,
} from "./consignment-records";

/** Each source is read in one page; the list says so when a source fills it. */
export const CONSIGNMENTS_PAGE_LIMIT = 100;

export type ConsignmentsRead = {
  /** `null` when neither submissions nor lots could be read. */
  records: ConsignmentRecord[] | null;
  /** A source filled its page, so older work may be missing. */
  truncated: boolean;
};

function orEmpty<T>(promise: Promise<T[]>): Promise<T[]> {
  return promise.catch(() => []);
}

/**
 * The acting account's consignments as one list: submissions, the lots they became (open and
 * ended), their agreements and unsold choices, and what waits on the member. Every account, a
 * person's own as much as an organisation, reads "what waits" from the one Needs-you reader, so
 * the list, its tab count and Home always agree.
 */
export async function loadConsignments(
  ctx: SellerWorkspaceContext,
  viewerUserId: string,
): Promise<ConsignmentsRead> {
  const { sellerEntityId } = ctx;
  if (!sellerEntityId || !sellerCan(ctx, "entity.consignments.read")) {
    return { records: [], truncated: false };
  }
  const c = await getServerDataContainer();
  const limit = CONSIGNMENTS_PAGE_LIMIT;
  const [submissions, openLots, endedLots, agreements, unsold, needsYou] = await Promise.all([
    c.submissions.listMine({ limit, offset: 0 }).catch((): ItemSubmission[] | null => null),
    c.sellerLots.list({ sellerId: sellerEntityId, limit }).catch((): Lot[] | null => null),
    orEmpty(c.sellerLots.list({ sellerId: sellerEntityId, status: "ended", limit })),
    orEmpty<ConsignmentAgreement>(listServerConsignmentAgreements()),
    // Roles that cannot see after-sale choices are refused; their list shows "Did not sell".
    listServerUnsoldOutcomes({ limit, offset: 0 })
      .then((page) => [...page.rows])
      .catch((): SellerUnsoldOutcome[] => []),
    getServerNeedsYou(sellerEntityId),
  ]);
  if (!submissions && !openLots) return { records: null, truncated: false };

  // A consignor sees only the lots made from their own submissions.
  const lots = visibleConsignedLots({
    lots: [...(openLots ?? []), ...endedLots],
    submissions: submissions ?? [],
    scope: consignedLotScope(ctx.actor),
    viewerUserId,
  });
  // Without the reader the list shows no tasks rather than ones that disagree with Home.
  const tasks: ConsignmentTasks = needsYou
    ? consignmentTasksFromNeedsYou(needsYou.tasks)
    : NO_CONSIGNMENT_TASKS;
  const saleTitleById = await resolveSaleTitles(lots.map((lot) => lot.saleId));
  return {
    records: buildConsignmentRecords({
      submissions: submissions ?? [],
      lots,
      agreements,
      unsold,
      saleTitleById,
      tasks,
      now: new Date(),
    }),
    truncated: [submissions ?? [], openLots ?? [], endedLots].some((rows) => rows.length >= limit),
  };
}
