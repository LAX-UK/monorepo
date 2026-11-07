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
import type { DealPartyResolver, ResolvedDealParty } from "./deal-party-resolver.js";

export type EnquiryConversionDeps = {
  enquiries: Pick<IMarketingEnquiryRepository, "findByRef" | "updateInTransaction">;
  works: IDealWorkStore;
  /** The deal store, bound to the transaction the conversion runs in. */
  dealsForTx: (tx: Database) => Pick<IPrivateSaleDealWriter, "create">;
  parties: DealPartyResolver;
  policy: PrivateSalePolicy;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
};

/** Thrown inside the transaction so the deal and the enquiry change together or not at all. */
class EnquiryMovedOn extends Error {}

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

    try {
      const reference = await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const itemSubmissionId = await sides.workId(tx);
        const deal = await this.deps.dealsForTx(tx).create({
          itemSubmissionId,
          sourceEnquiryId: enquiry.id,
          ownerUserId: viewer.userId,
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
    if (!work.submittedByUserId) return { error: "work_has_no_seller_contact" };
    if (work.legalEntityId === enquirer.legalEntityId) return { error: "buyer_is_seller" };
    return {
      seller: { legalEntityId: work.legalEntityId, actingUserId: work.submittedByUserId },
      buyer: enquirer,
      workId: async () => work.id,
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
