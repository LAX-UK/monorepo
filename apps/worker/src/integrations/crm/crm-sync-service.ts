import type { ICrmRecordLinkRepository } from "@auction/persistence/interfaces";
import type { WorkerEnv } from "../../env.js";
import { crmErrorOutcome } from "./classify-crm-error.js";
import {
  type CrmMappedIntent,
  type CrmMapperContext,
  type DomainEventRowForCrm,
  mapDomainEventToCrmIntent,
} from "./crm-event-mappers.js";
import type { CrmGateway } from "./crm-gateway.js";
import type { CrmAttributionReader, CrmPaymentLotReader } from "./crm-readers.js";
import type { CrmSyncResult } from "./crm-sync-result.js";
import { CrmDealSyncHandler } from "./handlers/crm-deal-sync-handler.js";
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
};

export class CrmSyncService {
  private readonly personHandler: CrmPersonSyncHandler;
  private readonly dealHandler: CrmDealSyncHandler;
  private readonly lifecycleHandler: CrmSubjectLifecycleHandler;
  private readonly shopRecordHandler: CrmShopRecordSyncHandler;

  constructor(private readonly deps: CrmSyncServiceDeps) {
    const dealHandlerRef: { current: CrmDealSyncHandler | null } = { current: null };
    this.personHandler = new CrmPersonSyncHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
      onContactLinked: (subjectId) =>
        dealHandlerRef.current?.patchDealContactLookupsForSubject(subjectId) ?? Promise.resolve(),
    });
    this.dealHandler = new CrmDealSyncHandler({
      gateway: deps.gateway,
      linkRepo: deps.linkRepo,
      personHandler: this.personHandler,
      leadConversionEnabled: deps.env.ZOHO_CRM_LEAD_CONVERSION_ENABLED,
    });
    dealHandlerRef.current = this.dealHandler;
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

    const intent = mapDomainEventToCrmIntent(
      event,
      {
        ...this.deps.mapperContext,
        attribution,
      },
      paymentRefundLotId !== undefined ? { paymentRefundLotId } : {},
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
        );
      case "person_patch":
        return this.personHandler.syncPerson(intent.subjectId, "", intent.fields, "patch");
      case "deal_upsert":
        return this.dealHandler.syncDeal(intent);
      case "deal_stage":
        return this.dealHandler.updateDealStage(intent.dealEntityId, intent.stage);
      case "convert_lead_on_win":
        return this.dealHandler.convertLeadAndCreateDeal(intent);
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
