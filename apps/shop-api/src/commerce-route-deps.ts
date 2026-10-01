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
  StripeCheckoutAsyncFailedDto,
  StripeCheckoutCompletedDto,
  StripeCheckoutExpiredDto,
} from "./application/ports/stripe-webhook.types.js";

export type CommerceRoutesDeps = {
  getBasket: ReturnType<typeof createGetBasketHandler>;
  upsertBasketLine: ReturnType<typeof createUpsertBasketLineHandler>;
  removeBasketLine: ReturnType<typeof createRemoveBasketLineHandler>;
  mergeBaskets: ReturnType<typeof createMergeBasketsHandler>;
  checkoutOrder: ReturnType<typeof createCheckoutOrderHandler>;
  resumeCheckoutOrder: ReturnType<typeof createResumeCheckoutOrderHandler>;
  cancelCheckoutOrder: ReturnType<typeof createCancelCheckoutOrderHandler>;
  listOrders: ReturnType<typeof createListOrdersHandler>;
  getOrder: ReturnType<typeof createGetOrderHandler>;
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
};
