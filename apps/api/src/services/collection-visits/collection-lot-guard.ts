import {
  type CollectionBlockReason,
  type CollectionSelectionLot,
  accountPurchaseScope,
  collectionBlockMessage,
  collectionBooker,
  collectionEligibility,
  lotSelectionRefusal,
} from "@auction/domain";
import type {
  CollectionLotRecord,
  ICollectionLotFactsReader,
} from "@auction/persistence/interfaces";
import type { CollectionLotLine } from "@auction/types";
import { err, ok } from "neverthrow";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import { type CollectionVisitResult, visitError } from "./collection-visit.errors.js";

/** Whether the member sees only the purchases they won themselves (a buyer agent). */
function followsOwnOnly(actor: OrganisationMemberActor): boolean {
  return (
    accountPurchaseScope({ role: actor.role, isImpersonation: actor.isImpersonation }) === "own"
  );
}

export type ResolvedLots = {
  records: CollectionLotRecord[];
  /** The one place all the lots are collected from. */
  venueId: string;
  /** Every lot, with whether it can be ticked and why not. */
  lines: CollectionLotLine[];
};

export type ResolveOptions = {
  /** The booking being changed: a lot it already holds is not "already booked". */
  ownBookingId?: string | null;
  /** Writes need every lot collectable; a read just reports which are not. */
  requireCollectable: boolean;
  /** Whether the person is about to change something: viewing as the account only reads. */
  write: boolean;
};

/**
 * Decides which lots a person may deal with, in one place, so booking, changing and looking at
 * times can never disagree:
 * 1. every lot exists and was bought by the acting account (otherwise it is "not found", so another
 *    account's lot is never confirmed to exist);
 * 2. up to 20, each once, from one collection place;
 * 3. the person may book them: their own wins for a buyer agent, any paid lot for an organisation's
 *    owners, admins and finance, their own wins on a personal account; never while viewing as the account.
 *    A lot they do not follow (someone else's win) is "not found" too, like in their purchases;
 * 4. each lot can be collected: paid and cleared, no check open, not delivered, not already booked.
 */
export class CollectionLotGuard {
  constructor(private readonly facts: Pick<ICollectionLotFactsReader, "read" | "lotIdsForBuyer">) {}

  async resolve(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
    options: ResolveOptions,
  ): Promise<CollectionVisitResult<ResolvedLots>> {
    if (lotIds.length === 0) return err(visitError("no_lots"));
    const found = await this.facts.read(lotIds);

    const records: CollectionLotRecord[] = [];
    for (const lotId of lotIds) {
      const record = found.get(lotId);
      if (!record || record.buyerLegalEntityId !== actor.legalEntityId) {
        return err(visitError("lot_not_found"));
      }
      records.push(record);
    }

    const withoutPlace = records.find((record) => record.venueId === null);
    if (withoutPlace) return err(visitError("lot_without_place", { lotId: withoutPlace.lotId }));
    const selection: CollectionSelectionLot[] = records.map((record) => ({
      lotId: record.lotId,
      accountId: actor.legalEntityId,
      placeId: record.venueId as string,
    }));
    const selectionRefusal = lotSelectionRefusal(selection);
    if (selectionRefusal === "no_lots") return err(visitError("no_lots"));
    if (selectionRefusal === "too_many_lots") return err(visitError("too_many_lots"));
    if (selectionRefusal === "duplicate_lots") return err(visitError("duplicate_lots"));
    if (selectionRefusal) return err(visitError("mixed_places"));

    for (const record of records) {
      const decision = collectionBooker({
        userId: actor.userId,
        accountKind: record.buyerAccountKind ?? "individual",
        winnerId: record.winnerId,
        membership: { role: actor.role },
        isImpersonation: options.write ? actor.isImpersonation : false,
      });
      if (decision.allowed) continue;
      if (decision.reason === "read_only") return err(visitError("read_only"));
      if (decision.reason === "not_member") return err(visitError("insufficient_entity_role"));
      // A lot the person does not follow (someone else's personal purchase, or a colleague's win
      // for a buyer agent who sees only their own) is answered as not found, never confirmed.
      if (decision.reason === "not_winner" || followsOwnOnly(actor)) {
        return err(visitError("lot_not_found"));
      }
      return err(
        visitError("lot_not_yours_to_book", { lotId: record.lotId, reason: decision.reason }),
      );
    }

    const lines = records.map((record) => this.lineOf(record, options.ownBookingId ?? null));
    if (options.requireCollectable) {
      const blocked = lines.find((line) => !line.collectable);
      if (blocked) {
        return err(
          visitError("lot_not_collectable", {
            lotId: blocked.lotId,
            ...(blocked.blockedReason ? { reason: blocked.blockedReason } : {}),
          }),
        );
      }
    }
    return ok({ records, venueId: records[0]?.venueId as string, lines });
  }

  /**
   * The account's other works at this place that the person may book and that can be collected now,
   * after the ones asked about, up to `room` of them. Works that cannot be booked are left out: this
   * is an offer, not a status report.
   */
  async othersAtPlace(
    actor: OrganisationMemberActor,
    venueId: string,
    exclude: readonly string[],
    room: number,
  ): Promise<CollectionLotLine[]> {
    if (room <= 0) return [];
    const candidates = (await this.facts.lotIdsForBuyer(actor.legalEntityId, venueId, 200)).filter(
      (id) => !exclude.includes(id),
    );
    if (candidates.length === 0) return [];
    const found = await this.facts.read(candidates);
    const lines: CollectionLotLine[] = [];
    for (const id of candidates) {
      const record = found.get(id);
      if (!record || record.buyerLegalEntityId !== actor.legalEntityId) continue;
      const decision = collectionBooker({
        userId: actor.userId,
        accountKind: record.buyerAccountKind ?? "individual",
        winnerId: record.winnerId,
        membership: { role: actor.role },
        isImpersonation: false,
      });
      if (!decision.allowed) continue;
      const line = this.lineOf(record, null);
      if (line.collectable) lines.push(line);
      if (lines.length >= room) break;
    }
    return lines;
  }

  private lineOf(record: CollectionLotRecord, ownBookingId: string | null): CollectionLotLine {
    const facts =
      ownBookingId !== null && record.facts.activeBookingId === ownBookingId
        ? { ...record.facts, activeBookingId: null }
        : record.facts;
    const decision = collectionEligibility(facts);
    const reason: CollectionBlockReason | null = decision.eligible ? null : decision.reason;
    return {
      lotId: record.lotId,
      title: record.title,
      lotNumber: record.lotNumber,
      collectable: decision.eligible,
      blockedReason: reason,
      blockedMessage: reason ? collectionBlockMessage(reason) : null,
    };
  }
}
