import type { IAttributionStore } from "@auction/marketing-events";
import type { Redis } from "ioredis";
import { LotError, PaymentProviderError } from "../../lib/errors.js";
import type { AuthzError } from "../../lib/errors.js";
import { buildEnrichedWebsiteUserEvent } from "../../lib/marketing-attribution-context.js";
import type { WebsiteEventContext } from "../../lib/marketing-event-factory.js";
import { checkSofDocumentAttachRateLimit } from "../../lib/sof-document-attach-rate-limit.js";
import type { IBuyerComplianceHttpApplicationService } from "../interfaces/compliance-routes/compliance-buyer-http.js";
import type {
  BuyerCheckoutHttpResult,
  BuyerSofAttachResult,
  BuyerSofSubmitResult,
  IBuyerPaymentHttpApplicationService,
} from "../interfaces/finance-routes/finance-buyer-payment-http.js";
import type { FinanceRouteOutcome } from "../interfaces/finance-routes/finance-route-http.js";
import type { ILotFulfilmentBuyerService } from "../interfaces/lot-fulfilment-service.js";
import type { IMarketingEventService } from "../interfaces/marketing-event-service.js";
import type { IPaymentBuyerService } from "../interfaces/payment-service.js";
import type { SourceOfFundsDocumentCollectionService } from "../source-of-funds/source-of-funds-document-collection.service.js";

function mapSofAttachError(message: string): { status: number; error: string } | null {
  if (message === "source_of_funds_not_found") return { status: 404, error: message };
  if (message === "source_of_funds_forbidden") return { status: 403, error: message };
  if (
    message === "source_of_funds_documents_not_requested" ||
    message === "source_of_funds_documents_already_submitted" ||
    message === "source_of_funds_not_pending"
  ) {
    return { status: 409, error: message };
  }
  if (
    message === "upload_not_active" ||
    message === "upload_kind_mismatch" ||
    message === "source_of_funds_requested_type_not_allowed"
  ) {
    return { status: 400, error: message };
  }
  return null;
}

function mapSofSubmitError(message: string): { status: number; error: string } | null {
  if (message === "source_of_funds_not_found") return { status: 404, error: message };
  if (message === "source_of_funds_forbidden") return { status: 403, error: message };
  if (
    message === "source_of_funds_documents_not_requested" ||
    message === "source_of_funds_documents_already_submitted" ||
    message === "source_of_funds_no_documents_to_submit"
  ) {
    return { status: 409, error: message };
  }
  return null;
}

function mapBuyerCommandError(error: AuthzError | LotError): FinanceRouteOutcome<{ ok: true }> {
  const code = error instanceof LotError && error.code !== undefined ? error.code : undefined;
  return {
    kind: "err",
    error: {
      message: error.message,
      status: error.status,
      ...(code !== undefined ? { code } : {}),
    },
  };
}

export class BuyerPaymentHttpApplicationService implements IBuyerPaymentHttpApplicationService {
  constructor(
    private readonly redis: Redis,
    private readonly sourceOfFundsDocumentCollectionService: SourceOfFundsDocumentCollectionService,
    private readonly paymentBuyerService: IPaymentBuyerService,
    private readonly buyerComplianceHttp: IBuyerComplianceHttpApplicationService,
    private readonly lotFulfilmentBuyer: ILotFulfilmentBuyerService,
    private readonly marketingEventService: IMarketingEventService,
    private readonly attributionStore: IAttributionStore,
    private readonly marketingAttributionEnabled: boolean,
  ) {}

  async getBuyerComplianceGate(
    buyerUserId: string,
  ): Promise<
    FinanceRouteOutcome<Awaited<ReturnType<IPaymentBuyerService["getBuyerComplianceGateStatus"]>>>
  > {
    const data = await this.paymentBuyerService.getBuyerComplianceGateStatus(buyerUserId);
    return { kind: "ok", data };
  }

  async getBuyerSourceOfFundsView(buyerUserId: string) {
    const view = await this.buyerComplianceHttp.getBuyerSourceOfFundsView(buyerUserId);
    return { kind: "ok" as const, data: view.data };
  }

  async listMyPayments(
    buyerUserId: string,
    options: { status?: import("@auction/types").PaymentStatus },
  ) {
    const { data } = await this.paymentBuyerService.listMyPaymentsForBuyerApi(buyerUserId, {
      ...(options.status !== undefined ? { status: options.status } : {}),
    });
    return { kind: "ok" as const, data };
  }

  async cancelPendingPayment(buyerUserId: string, paymentId: string) {
    const result = await this.paymentBuyerService.cancelPendingAsBuyer(buyerUserId, paymentId);
    return result.match(
      () => ({ kind: "ok" as const, data: { ok: true as const } }),
      (error) => mapBuyerCommandError(error),
    );
  }

  async getWinnerLotFulfilment(buyerUserId: string, lotId: string) {
    const result = await this.lotFulfilmentBuyer.getForWinner(buyerUserId, lotId);
    return result.match(
      (data) => ({ kind: "ok" as const, data }),
      (error) =>
        ({
          kind: "err" as const,
          error: {
            message: error.message,
            status: error.status,
            ...(error.code ? { code: error.code } : {}),
          },
        }) satisfies FinanceRouteOutcome<null>,
    );
  }

  async initiateBuyerCheckout(input: {
    buyerUserId: string;
    lotId: string;
    addressId: string;
    websiteContext: WebsiteEventContext;
  }): Promise<BuyerCheckoutHttpResult> {
    const result = await this.paymentBuyerService.createPendingForWinner(
      input.buyerUserId,
      input.lotId,
      input.addressId,
    );
    if (result.isErr()) {
      const error = result.error;
      let code: string | undefined;
      if (error instanceof PaymentProviderError && error.stripeCode) {
        code = error.stripeCode;
      } else if (error instanceof LotError && error.code) {
        code = error.code;
      }
      return {
        ok: false,
        status: error.status,
        error: error.message,
        ...(code ? { code } : {}),
      };
    }
    const data = result.value;
    const marketingEventId = crypto.randomUUID();
    try {
      await this.marketingEventService.emit(
        await buildEnrichedWebsiteUserEvent(
          input.websiteContext,
          {
            name: "InitiateCheckout",
            eventId: marketingEventId,
            userId: input.buyerUserId,
            customData: { lotId: input.lotId, paymentId: data.paymentId },
          },
          {
            attributionEnabled: this.marketingAttributionEnabled,
            attributionStore: this.attributionStore,
          },
        ),
      );
    } catch {
      // Committed pending payment must not be rolled back when marketing delivery fails.
    }
    return {
      ok: true,
      status: 201,
      data: {
        ...data,
        marketingEventId,
      },
    };
  }

  async attachSourceOfFundsDocument(input: {
    buyerUserId: string;
    caseId: string;
    uploadObjectId: string;
    requestedType: string;
    label?: string | null;
  }): Promise<BuyerSofAttachResult> {
    const allowed = await checkSofDocumentAttachRateLimit(this.redis, input.buyerUserId);
    if (!allowed) {
      return { ok: false, status: 429, error: "rate_limited" };
    }
    try {
      const doc = await this.sourceOfFundsDocumentCollectionService.attachDocument({
        caseId: input.caseId,
        buyerUserId: input.buyerUserId,
        uploadObjectId: input.uploadObjectId,
        requestedType: input.requestedType,
        label: input.label ?? null,
      });
      return { ok: true, document: doc };
    } catch (err) {
      const message = err instanceof Error ? err.message : "attach_failed";
      const mapped = mapSofAttachError(message);
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
  }

  async submitSourceOfFundsDocuments(input: {
    buyerUserId: string;
    caseId: string;
  }): Promise<BuyerSofSubmitResult> {
    try {
      const record = await this.sourceOfFundsDocumentCollectionService.submitDocuments({
        caseId: input.caseId,
        buyerUserId: input.buyerUserId,
      });
      return { ok: true, sourceOfFunds: record };
    } catch (err) {
      const message = err instanceof Error ? err.message : "submit_failed";
      const mapped = mapSofSubmitError(message);
      if (mapped) return { ok: false, ...mapped };
      throw err;
    }
  }
}
