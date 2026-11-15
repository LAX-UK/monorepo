import {
  REOPEN_REFUSAL_MESSAGE,
  type ReopenGallerySaleRefusal,
  SOLD_WHILE_LIVE_EMPTY_STATE,
  checkOverrideReason,
  soldWhere,
  soldWhileLiveCopy,
} from "@auction/artwork-register-contracts";
import { formatDate } from "@auction/datetime";
import type {
  AdminRegisterReopenResult,
  AdminSoldAttentionItem,
  AdminSoldAttentionList,
  AdminSoldAttentionOverrideBody,
  AdminSoldAttentionOverrideResult,
} from "@auction/shop-contracts";
import type {
  GallerySaleReopener,
  LotNumberReader,
  SoldAttentionAudit,
  SoldAttentionQueue,
} from "../ports/sold-attention.ports.js";

/** More than staff could act on at once; the list is a to-do, not an archive. */
const LIST_LIMIT = 200;
const DATE_ZONE = "Europe/London";

export type SoldAttentionReviewDeps = {
  queue: SoldAttentionQueue;
  lots: LotNumberReader;
  /** The register, for Reopen; absent where it is not wired, which refuses Reopen as not found. */
  sales?: GallerySaleReopener;
  audit?: SoldAttentionAudit;
  now?: () => Date;
};

export type DealtWithOutcome =
  | { kind: "dealt_with"; result: AdminSoldAttentionOverrideResult }
  | { kind: "not_found" | "not_open" | "not_sold_in_gallery" };

export type ReopenOutcome =
  | { kind: "reopened"; result: AdminRegisterReopenResult }
  | { kind: "refused"; refusal: ReopenGallerySaleRefusal; message: string }
  | { kind: "not_found" | "version_conflict" };

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
        soldInGallery: soldWhere(entry.offer) === "gallery",
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
      now: this.now(),
    });
    if (!result.ok) return { kind: result.reason };
    return {
      kind: "overridden",
      result: { id: result.item.id, registerId: result.item.registerId },
    };
  }

  /**
   * "Dealt with": staff have handled any checkout or invoice still open for an artwork since
   * recorded as sold in the gallery. Ends the hold on payments; kept in the artwork's history.
   */
  async dealtWith(input: {
    attentionId: string;
    actorSubjectId: string;
  }): Promise<DealtWithOutcome> {
    const result = await this.deps.queue.markDealtWith({
      id: input.attentionId,
      actor: `staff:${input.actorSubjectId}`,
      now: this.now(),
    });
    if (!result.ok) return { kind: result.reason };
    await this.deps.audit?.({
      actorSubjectId: input.actorSubjectId,
      capability: "artwork_register.review",
      action: "sold_attention_dealt_with",
      targetType: "artwork_register",
      targetId: result.item.registerId,
      afterJson: { attentionId: result.item.id },
    });
    return {
      kind: "dealt_with",
      result: { id: result.item.id, registerId: result.item.registerId },
    };
  }

  /**
   * Reopen: an Administrator takes back a sale made in the gallery that Zoho reported by mistake.
   * The artwork returns to held and nothing is offered again by itself. Refused while Zoho still
   * says Sold (Zoho wins) and for a sale made through LAX. The reason is kept in the history.
   */
  async reopen(input: {
    registerId: string;
    reason: string;
    actorSubjectId: string;
  }): Promise<ReopenOutcome> {
    if (!this.deps.sales) return { kind: "not_found" };
    const result = await this.deps.sales.reopenGallerySale({
      registerId: input.registerId,
      reason: input.reason,
      actor: `staff:${input.actorSubjectId}`,
      now: this.now(),
    });
    if (!result.ok) {
      if (result.refusal === "not_found" || result.refusal === "version_conflict") {
        return { kind: result.refusal };
      }
      return {
        kind: "refused",
        refusal: result.refusal,
        message: REOPEN_REFUSAL_MESSAGE[result.refusal],
      };
    }
    await this.deps.audit?.({
      actorSubjectId: input.actorSubjectId,
      capability: "artwork_register.reopen_sold",
      action: "reopen_gallery_sale",
      targetType: "artwork_register",
      targetId: result.entry.id,
      beforeJson: { offerState: "sold", soldWhere: "gallery" },
      afterJson: { offerState: result.entry.offer.state, reason: result.reason },
    });
    return { kind: "reopened", result: { registerId: result.entry.id, offerState: "held" } };
  }

  private now(): Date {
    return (this.deps.now ?? (() => new Date()))();
  }
}
