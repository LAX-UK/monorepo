import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import type { WorkerEnv } from "../../env.js";
import { crmErrorOutcome } from "./classify-crm-error.js";
import type { CrmDealNamingFacts, CrmDealNamingReader } from "./crm-deal-naming-reader.js";
import {
  type CrmMappedIntent,
  type CrmMapperContext,
  type DomainEventRowForCrm,
  mapDomainEventToCrmIntent,
} from "./crm-event-mappers.js";
import type { CrmGateway } from "./crm-gateway.js";
import type {
  CrmAttributionReader,
  CrmEnquiryReader,
  CrmEnquiryRecord,
  CrmPaymentLotReader,
} from "./crm-readers.js";
import type { CrmSyncResult } from "./crm-sync-result.js";
import { CrmDealSyncHandler } from "./handlers/crm-deal-sync-handler.js";
import {
  type CrmConversionSweepResult,
  CrmLeadConversionHandler,
} from "./handlers/crm-lead-conversion-handler.js";
import { CrmPaidBuyerHandler } from "./handlers/crm-paid-buyer-handler.js";
import { CrmPersonSyncHandler } from "./handlers/crm-person-sync-handler.js";
import { CrmShopRecordSyncHandler } from "./handlers/crm-shop-record-sync-handler.js";
import { CrmSubjectLifecycleHandler } from "./handlers/crm-subject-lifecycle-handler.js";

export type { CrmSyncResult } from "./crm-sync-result.js";

export type CrmSyncServiceDeps = {
  gateway: CrmGateway;
  linkRepo: ICrmRecordLinkRepository;
  env: WorkerEnv;
  mapperContext: Omit<CrmMapperContext, "attribution">;
  paymentLotReader: CrmPaymentLotReader;
  attributionReader: CrmAttributionReader;
  enquiryReader: CrmEnquiryReader;
  dealNamingReader: CrmDealNamingReader;
};

export class CrmSyncService {
  private readonly personHandler: CrmPersonSyncHandler;
  private readonly dealHandler: CrmDealSyncHandler;
  private readonly conversionHandler: CrmLeadConversionHandler;
  private readonly lifecycleHandler: CrmSubjectLifecycleHandler;
  private readonly shopRecordHandler: CrmShopRecordSyncHandler;

  constructor(private readonly deps: CrmSyncServiceDeps) {
    const dealHandlerRef: { current: CrmDealSyncHandler | null } = { current: null };
    this.personHandler = new CrmPersonSyncHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
      onContactLinked: async (subjectId) => {
        // The person now has a Contact: waiting purchases become Deals on it.
        await dealHandlerRef.current?.releaseHeldDealsForSubject(subjectId);
        await dealHandlerRef.current?.patchDealContactLookupsForSubject(subjectId);
      },
    });
    this.dealHandler = new CrmDealSyncHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
      personHandler: this.personHandler,
      paidBuyerHandler: new CrmPaidBuyerHandler({
        gateway: deps.gateway,
        linkRepo: deps.linkRepo,
      }),
    });
    dealHandlerRef.current = this.dealHandler;
    this.conversionHandler = new CrmLeadConversionHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
      dealHandler: this.dealHandler,
    });
    this.lifecycleHandler = new CrmSubjectLifecycleHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
    });
    this.shopRecordHandler = new CrmShopRecordSyncHandler({
      gateway: deps.gateway,
      catalogueSyncEnabled: deps.env.SHOP_ZOHO_CATALOGUE_SYNC_ENABLED,
      financialsSyncEnabled: deps.env.SHOP_ZOHO_FINANCIALS_ENABLED,
    });
  }

  getGatewayMetrics(): ReturnType<CrmGateway["getMetrics"]> {
    return this.deps.gateway.getMetrics();
  }

  /** The client and work a deal is named after, read for the events that create a deal. */
  private async resolveDealNaming(
    event: DomainEventRowForCrm,
  ): Promise<CrmDealNamingFacts | undefined> {
    const reader = this.deps.dealNamingReader;
    const p = event.payload as Record<string, unknown> | null;
    if (!p || typeof p !== "object") return undefined;
    const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : null);
    switch (event.eventType) {
      case "bid.lot_won": {
        const lotId = text("lotId");
        const userId = text("userId");
        return lotId && userId ? reader.forLotWon({ lotId, userId }) : undefined;
      }
      case "shop.artwork.interest_registered": {
        const artworkId = text("artworkId");
        const subjectId = text("identitySubjectId");
        return p.intent === "enquiry" && artworkId && subjectId
          ? reader.forShopEnquiry({ artworkId, subjectId })
          : undefined;
      }
      case "shop.order.paid": {
        const orderId = text("orderId");
        const subjectId = text("identitySubjectId");
        const lineCount = typeof p.lineCount === "number" ? p.lineCount : 1;
        return orderId && subjectId
          ? reader.forShopOrder({ orderId, subjectId, lineCount })
          : undefined;
      }
      default:
        return undefined;
    }
  }

  /** Puts purchases that waited for an admin's lead conversion onto the new Contact. */
  async releaseConvertedLeads(): Promise<CrmConversionSweepResult> {
    return this.conversionHandler.releaseConvertedLeads();
  }

  async syncEvent(event: DomainEventRowForCrm): Promise<CrmSyncResult> {
    const attribution =
      event.eventType === "user.registered"
        ? await this.deps.attributionReader.loadFirstTouchFields(
            (event.payload as { userId?: string })?.userId ?? parsePayloadUserId(event) ?? "",
          )
        : null;

    let paymentRefundLotId: string | undefined;
    if (event.eventType === "payment.refunded") {
      const lotId = await this.resolveLotIdForPayment(event.aggregateId, event.payload);
      if (!lotId) {
        return { outcome: "skipped", reason: "payment_refund_missing_lot" };
      }
      paymentRefundLotId = lotId;
    }

    // The event carries no personal data: the enquiry is read by id.
    let enquiry: CrmEnquiryRecord | null | undefined;
    if (event.eventType === "marketing_enquiry.received") {
      enquiry = await this.deps.enquiryReader.findById(event.aggregateId);
    }

    const dealNaming = await this.resolveDealNaming(event);

    const intent = mapDomainEventToCrmIntent(
      event,
      {
        ...this.deps.mapperContext,
        attribution,
      },
      {
        ...(paymentRefundLotId !== undefined ? { paymentRefundLotId } : {}),
        ...(enquiry !== undefined ? { enquiry } : {}),
        ...(dealNaming !== undefined ? { dealNaming } : {}),
      },
    );

    if (intent.kind === "skip") {
      return { outcome: "skipped", reason: intent.reason };
    }

    try {
      const primary = await this.dispatch(intent);
      if (event.eventType === "shop.order.paid" && primary.outcome === "success") {
        const payload = event.payload as {
          orderId?: string;
          identitySubjectId?: string;
          totalPence?: number;
          paidAt?: string;
        };
        if (
          payload.orderId &&
          payload.identitySubjectId &&
          payload.totalPence !== undefined &&
          payload.paidAt
        ) {
          const financials = await this.shopRecordHandler.syncOrderPaidFinancials({
            orderId: payload.orderId,
            identitySubjectId: payload.identitySubjectId,
            totalPence: payload.totalPence,
            paidAt: payload.paidAt,
          });
          if (financials.outcome === "retry" || financials.outcome === "fatal") {
            return financials;
          }
        }
      }
      return primary;
    } catch (err) {
      const { retryable, error } = crmErrorOutcome(err);
      return retryable ? { outcome: "retry", error } : { outcome: "fatal", error };
    }
  }

  private async dispatch(intent: CrmMappedIntent): Promise<CrmSyncResult> {
    switch (intent.kind) {
      case "deletion_requested":
        return this.lifecycleHandler.handleDeletionRequested(intent.subjectId);
      case "deletion_cancelled":
        return this.lifecycleHandler.handleDeletionCancelled(intent.subjectId);
      case "merge_subjects":
        return this.lifecycleHandler.mergeSubjects(intent.subjectId, intent.retiredSubjectId);
      case "erase_subject":
        return this.lifecycleHandler.eraseSubject(intent.subjectId);
      case "person_upsert":
        return this.personHandler.syncPerson(
          intent.subjectId,
          intent.email,
          intent.fields,
          "upsert",
          { createOnlyFields: intent.createOnlyFields },
        );
      case "person_patch":
        return this.personHandler.syncPerson(intent.subjectId, "", intent.fields, "patch");
      case "deal_upsert":
        return this.dealHandler.syncDeal(intent);
      case "deal_stage":
        return this.dealHandler.updateDealStage(intent.dealEntityId, intent.stage);
      case "purchase_paid":
        return this.dealHandler.markPurchasePaid(intent);
      case "shop_artwork_product_upsert":
        return this.shopRecordHandler.syncArtworkCreated(intent);
      default:
        return { outcome: "skipped", reason: "unhandled_intent" };
    }
  }

  private async resolveLotIdForPayment(
    paymentAggregateId: string,
    payload: unknown,
  ): Promise<string | null> {
    const p = payload as { lotId?: string };
    if (p.lotId) return p.lotId;
    return this.deps.paymentLotReader.findLotIdForPayment(paymentAggregateId);
  }
}

function parsePayloadUserId(event: DomainEventRowForCrm): string | null {
  const payload = event.payload as { userId?: string; subjectId?: string };
  return payload.userId ?? payload.subjectId ?? null;
}
