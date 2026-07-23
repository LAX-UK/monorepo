import type { PaymentStatus } from "@auction/types";
import type { Result } from "neverthrow";
import type { AuthzError, LotError, PaymentProviderError } from "../../../lib/errors.js";
import type { WebsiteEventContext } from "../../../lib/marketing-event-factory.js";
import type { MyPaymentRowDTO } from "../../payment-me-presenter.js";
import type { SourceOfFundsDocumentCollectionService } from "../../source-of-funds/source-of-funds-document-collection.service.js";
import type { BuyerSourceOfFundsViewResult } from "../compliance-routes/compliance-buyer-http.js";
import type { LotFulfilmentRow } from "../lot-fulfilment-service.js";
import type { CreatePendingPaymentResult } from "../payment-service.js";
import type { FinanceRouteOutcome } from "./finance-route-http.js";

export type BuyerSofAttachResult =
  | {
      ok: true;
      document: Awaited<ReturnType<SourceOfFundsDocumentCollectionService["attachDocument"]>>;
    }
  | { ok: false; status: number; error: string };

export type BuyerSofSubmitResult =
  | {
      ok: true;
      sourceOfFunds: Awaited<ReturnType<SourceOfFundsDocumentCollectionService["submitDocuments"]>>;
    }
  | { ok: false; status: number; error: string };

export type BuyerCheckoutHttpData = CreatePendingPaymentResult & {
  marketingEventId: string;
};

export type BuyerCheckoutHttpResult =
  | { ok: true; status: 201; data: BuyerCheckoutHttpData }
  | { ok: false; status: number; error: string; code?: string };

export type BuyerComplianceGateData = Awaited<
  ReturnType<import("../payment-service.js").IPaymentBuyerService["getBuyerComplianceGateStatus"]>
>;

export interface IBuyerPaymentHttpApplicationService {
  getBuyerComplianceGate(
    buyerUserId: string,
  ): Promise<FinanceRouteOutcome<BuyerComplianceGateData>>;

  getBuyerSourceOfFundsView(
    buyerUserId: string,
  ): Promise<FinanceRouteOutcome<BuyerSourceOfFundsViewResult["data"]>>;

  listMyPayments(
    buyerUserId: string,
    options: { status?: PaymentStatus },
  ): Promise<FinanceRouteOutcome<MyPaymentRowDTO[]>>;

  cancelPendingPayment(
    buyerUserId: string,
    paymentId: string,
  ): Promise<FinanceRouteOutcome<{ ok: true }>>;

  getWinnerLotFulfilment(
    buyerUserId: string,
    lotId: string,
  ): Promise<FinanceRouteOutcome<LotFulfilmentRow | null>>;

  initiateBuyerCheckout(input: {
    buyerUserId: string;
    lotId: string;
    addressId: string;
    websiteContext: WebsiteEventContext;
  }): Promise<BuyerCheckoutHttpResult>;

  attachSourceOfFundsDocument(input: {
    buyerUserId: string;
    caseId: string;
    uploadObjectId: string;
    requestedType: string;
    label?: string | null;
  }): Promise<BuyerSofAttachResult>;

  submitSourceOfFundsDocuments(input: {
    buyerUserId: string;
    caseId: string;
  }): Promise<BuyerSofSubmitResult>;
}

export type BuyerPaymentCheckoutError = AuthzError | LotError | PaymentProviderError;

export type BuyerPaymentCancelError = AuthzError | LotError;

export type BuyerPaymentCheckoutResult = Result<
  CreatePendingPaymentResult,
  BuyerPaymentCheckoutError
>;
