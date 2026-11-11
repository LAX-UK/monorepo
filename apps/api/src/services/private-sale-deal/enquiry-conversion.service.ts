import type { ArtworkRegisterEntry } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  type PrivateSalePolicy,
  canViewEnquiry,
  dealCreatedEvent,
  enquiryTransitionRefusal,
  initialDealTerms,
  isPrivateSaleEnquiryIntent,
} from "@auction/domain";
import type {
  IDealWorkStore,
  IMarketingEnquiryRepository,
  IPrivateSaleDealQueryReader,
  IPrivateSaleDealWriter,
  ITransactionRunner,
  MarketingEnquiryDetailRecord,
} from "@auction/persistence/interfaces";
import type { AdminDealConvertInput } from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  ConvertEnquiryResult,
  IEnquiryConversion,
} from "../interfaces/private-sale-deal-desk.js";
import type { DealLockLinks } from "./deal-lock-links.js";
import type { DealPartyResolver, ResolvedDealParty } from "./deal-party-resolver.js";
import {
  DealArtworkRefused,
  DealRegisterUnavailable,
  type IDealRegisterLock,
} from "./deal-register-lock.js";

export type EnquiryConversionDeps = {
  enquiries: Pick<IMarketingEnquiryRepository, "findByRef" | "updateInTransaction">;
  works: IDealWorkStore;
  /** The deal a work is already in, if any. */
  openDeals: Pick<IPrivateSaleDealQueryReader, "findLiveDealReferenceForWork">;
  /** The deal store, bound to the transaction the conversion runs in. */
  dealsForTx: (tx: Database) => Pick<IPrivateSaleDealWriter, "create">;
  /** The artworks in the register, to check one exists before a deal is opened for it. */
  artworks: { findById(id: string): Promise<ArtworkRegisterEntry | null> };
  /** Gives the register's refusal link its address. */
  lockLinks: Pick<DealLockLinks, "attach">;
  /** Holds an artwork for a deal, bound to the transaction the conversion runs in. */
  registerForTx: (tx: Database) => IDealRegisterLock;
  parties: DealPartyResolver;
  policy: PrivateSalePolicy;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

/** Thrown inside the transaction so the deal and the enquiry change together or not at all. */
class EnquiryMovedOn extends Error {}

/** The work stopped being available between the first look and the moment it was held. */
class WorkTaken extends Error {
  constructor(readonly reason: "work_not_available" | "work_in_deal") {
    super(reason);
  }
}

const ONE_OPEN_DEAL_INDEX = "private_sale_deal_one_open_per_work_uidx";

/** Whether the database refused the deal because the work is already in a live deal. */
export function isWorkAlreadyInDeal(error: unknown): boolean {
  for (let e: unknown = error, depth = 0; e && typeof e === "object" && depth < 5; depth += 1) {
    const { code, constraint, message, cause } = e as {
      code?: unknown;
      constraint?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      code === "23505" &&
      (constraint === ONE_OPEN_DEAL_INDEX ||
        (typeof message === "string" && message.includes(ONE_OPEN_DEAL_INDEX)))
    ) {
      return true;
    }
    e = cause;
  }
  return false;
}

type DealSides = {
  seller: ResolvedDealParty;
  buyer?: ResolvedDealParty;
  /** Opens the work, inside the transaction, when the enquiry brought one. */
  workId: (tx: Database) => Promise<string>;
};

/**
 * Turns a private sale enquiry into a proposed deal. A sell enquiry brings its own work, opened
 * here as a draft consignment with the enquirer as seller. A buy enquiry names a work that is
 * already with LAX, and the enquirer becomes the buyer. Either way the enquirer needs an account,
 * because the checks that gate the deal are recorded against one.
 */
export class EnquiryConversionService implements IEnquiryConversion {
  constructor(private readonly deps: EnquiryConversionDeps) {}

  async convert(
    viewer: { userId: string; readsPrivateSale: boolean },
    enquiryRef: string,
    input: AdminDealConvertInput,
  ): Promise<ConvertEnquiryResult> {
    const enquiry = await this.deps.enquiries.findByRef(enquiryRef);
    if (!enquiry || !canViewEnquiry(enquiry, { ...viewer, readsGeneral: false })) {
      return { ok: false, error: "enquiry_not_found" };
    }
    if (!isPrivateSaleEnquiryIntent(enquiry.intent)) {
      return { ok: false, error: "not_a_private_sale_enquiry" };
    }
    if (enquiry.status === "converted") return { ok: false, error: "already_converted" };
    if (
      enquiryTransitionRefusal({
        from: enquiry.status,
        to: "converted",
        intent: enquiry.intent,
        manual: false,
      })
    ) {
      return { ok: false, error: "not_ready" };
    }

    const sides = await this.sidesOf(enquiry, input);
    if ("error" in sides) return { ok: false, error: sides.error };
    // Exactly one: the artwork in the register, or why it is not there.
    if ((input.artworkRegisterId !== undefined) === (input.notInRegister !== undefined)) {
      return { ok: false, error: "artwork_choice_required" };
    }
    let artwork: ArtworkRegisterEntry | null = null;
    if (input.artworkRegisterId) {
      artwork = await this.deps.artworks.findById(input.artworkRegisterId);
      if (!artwork) return { ok: false, error: "artwork_not_found" };
      if (artwork.kind !== "original") return { ok: false, error: "artwork_not_original" };
    }

    try {
      const reference = await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const itemSubmissionId = await sides.workId(tx);
        const deal = await this.deps.dealsForTx(tx).create({
          itemSubmissionId,
          sourceEnquiryId: enquiry.id,
          ownerUserId: viewer.userId,
          ...(input.artworkRegisterId ? { artworkRegisterId: input.artworkRegisterId } : {}),
          ...(input.notInRegister ? { artworkUnlinkedReason: input.notInRegister.reason } : {}),
          seller: sides.seller,
          ...(sides.buyer ? { buyer: sides.buyer } : {}),
          ...initialDealTerms(this.deps.policy),
          actorUserId: viewer.userId,
        });
        const moved = await this.deps.enquiries.updateInTransaction(
          tx,
          enquiry.id,
          enquiry.version,
          { status: "converted" },
        );
        if (!moved) throw new EnquiryMovedOn();

        // The artwork is held for the deal in the same transaction: if the register shows it
        // somewhere else the whole conversion is undone, and nothing is left holding it.
        if (input.artworkRegisterId) {
          await this.deps
            .registerForTx(tx)
            .offer(input.artworkRegisterId, deal.id, `staff:${viewer.userId}`);
        }

        const events = this.deps.events.withTx(tx);
        const created = dealCreatedEvent(deal);
        await events.publish({
          aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
          aggregateId: deal.id,
          eventType: created.eventType,
          payload: created.payload,
          actorUserId: viewer.userId,
          actingLegalEntityId: null,
        });
        await events.publish({
          aggregateType: "marketing_enquiry",
          aggregateId: enquiry.id,
          eventType: "marketing_enquiry.converted",
          payload: { enquiryId: enquiry.id, intent: enquiry.intent, from: enquiry.status },
          actorUserId: viewer.userId,
        });
        return deal.reference;
      });
      return { ok: true, reference };
    } catch (error) {
      if (error instanceof EnquiryMovedOn) return { ok: false, error: "stale_version" };
      if (error instanceof WorkTaken) return { ok: false, error: error.reason };
      if (error instanceof DealArtworkRefused) {
        const [lock] = artwork
          ? await this.deps.lockLinks.attach([{ entry: artwork, lock: error.lock }])
          : [error.lock];
        return {
          ok: false,
          error: "artwork_unavailable",
          message: error.message,
          ...(lock ? { lock } : {}),
        };
      }
      if (error instanceof DealRegisterUnavailable) {
        return { ok: false, error: "artwork_register_busy", message: error.message };
      }
      // Two people converting for the same work at once: the second is refused by the database.
      if (isWorkAlreadyInDeal(error)) return { ok: false, error: "work_in_deal" };
      throw error;
    }
  }

  private async sidesOf(
    enquiry: MarketingEnquiryDetailRecord,
    input: AdminDealConvertInput,
  ): Promise<DealSides | { error: ConvertEnquiryResultError }> {
    if (!enquiry.userId) return { error: "account_required" };
    const enquirer = await this.deps.parties.resolve({
      userId: enquiry.userId,
      legalEntityId: enquiry.legalEntityId ?? undefined,
    });
    if (!enquirer) return { error: "account_required" };

    if (enquiry.intent === "private_sale_sell") {
      return {
        seller: enquirer,
        workId: async (tx) => {
          const work = await this.deps.works.createDraftInTransaction(tx, {
            legalEntityId: enquirer.legalEntityId,
            ...workFields(enquiry),
            submittedByUserId: enquirer.actingUserId,
          });
          return work.id;
        },
      };
    }

    if (!input.workReference) return { error: "work_required" };
    const work = await this.deps.works.findByReference(input.workReference);
    if (!work) return { error: "work_not_found" };
    // Only an approved consignment that has not become a lot can be sold privately: not a draft,
    // a rejected or withdrawn work, one already sold, or one on a live or scheduled lot.
    if (work.status !== "approved" || work.convertedLotId !== null) {
      return { error: "work_not_available" };
    }
    if (await this.deps.openDeals.findLiveDealReferenceForWork(work.id))
      return { error: "work_in_deal" };
    if (!work.submittedByUserId) return { error: "work_has_no_seller_contact" };
    // Whoever acts for the seller must be a client with an active place in the owning account.
    const seller = await this.deps.parties.resolve({
      userId: work.submittedByUserId,
      legalEntityId: work.legalEntityId,
    });
    if (!seller) return { error: "work_has_no_seller_contact" };
    if (seller.legalEntityId === enquirer.legalEntityId) return { error: "buyer_is_seller" };
    return {
      seller,
      buyer: enquirer,
      // Held for the rest of the transaction, so a lot cannot be made from the work at the same
      // time; what was true a moment ago is checked again under the hold.
      workId: async (tx) => {
        const held = await this.deps.works.lockInTransaction(tx, work.id);
        if (!held || held.status !== "approved" || held.convertedLotId !== null) {
          throw new WorkTaken("work_not_available");
        }
        if (await this.deps.openDeals.findLiveDealReferenceForWork(work.id)) {
          throw new WorkTaken("work_in_deal");
        }
        return held.id;
      },
    };
  }
}

type ConvertEnquiryResultError = Extract<ConvertEnquiryResult, { ok: false }>["error"];

/** The work the enquirer described, as the draft consignment starts with it. */
function workFields(enquiry: MarketingEnquiryDetailRecord): {
  title: string;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
} {
  const detail = enquiry.privateSale;
  const description = [
    detail?.artist ? `Artist: ${detail.artist}` : null,
    detail?.locationTown || detail?.locationCountry
      ? `Now in ${[detail.locationTown, detail.locationCountry].filter(Boolean).join(", ")}`
      : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
  return {
    title: detail?.title?.trim() || detail?.artist?.trim() || "Untitled work",
    description: description === "" ? null : description,
    medium: detail?.medium ?? null,
    dimensions: detail?.size ?? null,
  };
}
