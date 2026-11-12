import {
  SOLD_WHILE_LIVE_EMPTY_STATE,
  checkOverrideReason,
  soldWhileLiveCopy,
} from "@auction/artwork-register-contracts";
import { formatDate } from "@auction/datetime";
import type {
  AdminSoldAttentionItem,
  AdminSoldAttentionList,
  AdminSoldAttentionOverrideBody,
  AdminSoldAttentionOverrideResult,
} from "@auction/shop-contracts";
import type { LotNumberReader, SoldAttentionQueue } from "../ports/sold-attention.ports.js";

/** More than staff could act on at once; the list is a to-do, not an archive. */
const LIST_LIMIT = 200;
const DATE_ZONE = "Europe/London";

export type SoldAttentionReviewDeps = {
  queue: SoldAttentionQueue;
  lots: LotNumberReader;
  now?: () => Date;
};

export type OverrideOutcome =
  | { kind: "overridden"; result: AdminSoldAttentionOverrideResult }
  | { kind: "reason_required" | "reason_too_long" | "not_found" | "not_open" };

/**
 * The "Needs attention" items for artworks Zoho says are sold while LAX still sells them: the list
 * staff work through, and "It is not sold", which needs a reason and clears the pause. Withdrawing
 * the artwork is done where the artwork lives; when it is withdrawn the item closes by itself.
 */
export class SoldAttentionReviewService {
  constructor(private readonly deps: SoldAttentionReviewDeps) {}

  async list(): Promise<AdminSoldAttentionList> {
    const rows = await this.deps.queue.listOpen(LIST_LIMIT);
    const lotIds = rows.flatMap(({ item }) =>
      (item.place === "bid_sale" || item.place === "bid_reoffer") && item.placeRefId
        ? [item.placeRefId]
        : [],
    );
    const numbers = lotIds.length > 0 ? await this.deps.lots.numbersFor(lotIds) : new Map();
    const items = rows.map(({ item, entry }): AdminSoldAttentionItem => {
      const copy = soldWhileLiveCopy({
        status: item.zohoStatus,
        place: item.place,
        title: entry.title,
        stockCode: entry.stockCode,
        markedOn: formatDate(item.markedAt, DATE_ZONE, { month: "long" }),
        lotNumber: item.placeRefId ? (numbers.get(item.placeRefId) ?? null) : null,
      });
      return {
        id: item.id,
        registerId: item.registerId,
        zohoProductId: item.zohoProductId,
        zohoStatus: item.zohoStatus,
        place: item.place,
        placeRefId: item.placeRefId,
        ...copy,
        raisedAt: item.raisedAt.toISOString(),
      };
    });
    return { items, emptyMessage: SOLD_WHILE_LIVE_EMPTY_STATE };
  }

  /** "It is not sold": the reason is kept in the artwork's history under the staff member's id. */
  async override(input: {
    attentionId: string;
    body: AdminSoldAttentionOverrideBody;
    actorSubjectId: string;
  }): Promise<OverrideOutcome> {
    const checked = checkOverrideReason(input.body.reason);
    if (!checked.ok) return { kind: checked.refusal };
    const result = await this.deps.queue.override({
      id: input.attentionId,
      reason: checked.reason,
      actor: `staff:${input.actorSubjectId}`,
      now: (this.deps.now ?? (() => new Date()))(),
    });
    if (!result.ok) return { kind: result.reason };
    return {
      kind: "overridden",
      result: { id: result.item.id, registerId: result.item.registerId },
    };
  }
}
