import type { LegalEntity } from "@auction/branding";
import type { EnquiryRateLimiter } from "./application/enquiry-rate-limit.js";
import type { createCancelCheckoutOrderHandler } from "./application/handlers/commerce-handlers.js";
import type { createCheckoutOrderHandler } from "./application/handlers/commerce-handlers.js";
import type { createGetBasketHandler } from "./application/handlers/commerce-handlers.js";
import type { createGetOrderHandler } from "./application/handlers/commerce-handlers.js";
import type { createListOrdersHandler } from "./application/handlers/commerce-handlers.js";
import type { createMergeBasketsHandler } from "./application/handlers/commerce-handlers.js";
import type { createRemoveBasketLineHandler } from "./application/handlers/commerce-handlers.js";
import type { createResumeCheckoutOrderHandler } from "./application/handlers/commerce-handlers.js";
import type { createUpsertBasketLineHandler } from "./application/handlers/commerce-handlers.js";
import type {
  createListSavedDeliveryAddressesHandler,
  createSaveDeliveryAddressHandler,
} from "./application/handlers/delivery-address-book.handler.js";
import type { OrderReader } from "./application/ports/commerce.ports.js";
import type { OrderProblemReportWriter } from "./application/ports/order-problem-report.port.js";
import type { StripeMoneyWebhookOutcome } from "./application/ports/stripe-money-webhook.types.js";
import type {
  StripeCheckoutAsyncFailedDto,
  StripeCheckoutCompletedDto,
  StripeCheckoutExpiredDto,
} from "./application/ports/stripe-webhook.types.js";

export type StripeWebhookDispatchResult =
  | { kind: "checkout"; outcome: string }
  | { kind: "money"; outcome: StripeMoneyWebhookOutcome }
  | { kind: "ignored" };

export type CommerceRoutesDeps = {
  merchandiseEnabled: boolean;
  /** Copies of one edition an order may hold; null leaves only the stock. */
  editionOrderLimit: number | null;
  getBasket: ReturnType<typeof createGetBasketHandler>;
  upsertBasketLine: ReturnType<typeof createUpsertBasketLineHandler>;
  removeBasketLine: ReturnType<typeof createRemoveBasketLineHandler>;
  mergeBaskets: ReturnType<typeof createMergeBasketsHandler>;
  checkoutOrder: ReturnType<typeof createCheckoutOrderHandler>;
  resumeCheckoutOrder: ReturnType<typeof createResumeCheckoutOrderHandler>;
  cancelCheckoutOrder: ReturnType<typeof createCancelCheckoutOrderHandler>;
  listOrders: ReturnType<typeof createListOrdersHandler>;
  getOrder: ReturnType<typeof createGetOrderHandler>;
  /** The buyer's name and email for the invoice. */
  getCustomerProfile: OrderReader["getCustomerProfile"];
  /** Who issues Shop invoices, and the VAT number printed on them when there is one. */
  invoiceIssuer: { supplier: LegalEntity; vatNumber: string | null };
  /** "Report a problem" on an order; the limiter is the one enquiries share. */
  orderProblems?: { writer: OrderProblemReportWriter; rateLimiter: EnquiryRateLimiter };
  /** The LAX Account address book; absent where Identity's machine client is not configured. */
  savedAddresses?: {
    list: ReturnType<typeof createListSavedDeliveryAddressesHandler>;
    save: ReturnType<typeof createSaveDeliveryAddressHandler>;
  };
};

export type StripeWebhookDeps = {
  webhookSecret: string | undefined;
  verifyWebhook(rawBody: Buffer, signature: string): unknown;
  parseCheckoutSessionCompleted(event: unknown): StripeCheckoutCompletedDto | null;
  parseCheckoutSessionExpired(event: unknown): StripeCheckoutExpiredDto | null;
  parseCheckoutSessionAsyncPaymentFailed(event: unknown): StripeCheckoutAsyncFailedDto | null;
  parseShopCheckoutCurrencyViolation?(event: unknown): {
    eventId: string;
    orderId: string;
    currency: string;
    sessionId: string;
  } | null;
  completeCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    amountTotalPence: number;
    paidAt: Date;
    customerEmail?: string | null;
  }): Promise<"processed" | "duplicate" | "terminal_acknowledged">;
  expireCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  failCheckout(input: {
    eventId: string;
    orderId: string;
    sessionId: string;
    source?: string;
  }): Promise<"processed" | "duplicate">;
  recordCurrencyViolation(input: {
    eventId: string;
    orderId: string;
    currency: string;
    sessionId: string;
  }): Promise<"processed" | "duplicate">;
  dispatchWebhook(event: unknown): Promise<StripeWebhookDispatchResult>;
};
