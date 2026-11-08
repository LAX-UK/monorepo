import { deliveryQuoteTransition } from "@auction/domain";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import {
  type DeliveryRegionId,
  assessOutsideUkDelivery,
  outsideUkAddressIssues,
  quoteHoldUntil,
} from "@auction/shop-domain";
import { DeliveryQuoteRequestRejectedError } from "../../errors/delivery-quote-request-rejected-error.js";
import { ShopApiError } from "../../errors/shop-api-error.js";
import type { DeliveryRegionsReader } from "../delivery-regions/delivery-regions.ports.js";
import type {
  CheckoutOrderResult,
  CheckoutWriter,
  ShopDeliveryAddress,
} from "../ports/commerce.ports.js";
import type {
  CreatedQuoteOrder,
  DeliveryQuoteOrderStore,
  DeliveryQuoteOwner,
} from "./delivery-quote-request.ports.js";

export type DeliveryQuoteRequestInput = DeliveryQuoteOwner & {
  basketId: string;
  idempotencyKey: string;
  /** Used only when the region has a fixed rate and the buyer goes straight to payment. */
  successUrl: string;
  cancelUrl: string;
  deliveryAddress: ShopDeliveryAddress & { recipientName: string };
  deliveryPhone: string;
  fallbackEmail: string | null;
};

export type DeliveryQuoteRequestOutcome =
  /** The prints are held while the gallery quotes the delivery. */
  | { kind: "quote_requested"; request: CreatedQuoteOrder }
  /** The region has a fixed rate: payment opens now, with delivery in the total. */
  | { kind: "pay_now"; session: CheckoutOrderResult }
  /** An export-restricted country: nothing was created; collection is offered instead. */
  | { kind: "not_delivered"; country: string };

export type DeliveryQuoteRequestDeps = {
  regions: DeliveryRegionsReader;
  orders: DeliveryQuoteOrderStore;
  checkout: Pick<CheckoutWriter, "createCheckoutOrder">;
  now?: () => Date;
};

/**
 * Checkout for an address outside the UK. The destination is read from the delivery regions as
 * they stand now, and decides everything: a country the Shop does not deliver to is refused with
 * nothing created, a region with a fixed rate pays like any other checkout, and anywhere else the
 * prints are held while the gallery quotes. The quote's own steps are the saleroom's state
 * machine, shared rather than copied.
 */
export function createDeliveryQuoteRequestService(deps: DeliveryQuoteRequestDeps) {
  const now = deps.now ?? (() => new Date());

  return {
    async request(input: DeliveryQuoteRequestInput): Promise<DeliveryQuoteRequestOutcome> {
      const address = input.deliveryAddress;
      const issues = outsideUkAddressIssues({
        recipientName: address.recipientName,
        line1: address.line1,
        ...(address.line2 !== undefined ? { line2: address.line2 } : {}),
        city: address.city,
        postcode: address.postcode,
        country: address.country,
        phone: input.deliveryPhone,
      });
      if (issues.length > 0) throw new DeliveryQuoteRequestRejectedError(issues);

      const state = await deps.regions.read();
      const assessment = assessOutsideUkDelivery(
        address.country,
        state.regions,
        state.restrictedCountries,
      );
      if (assessment.kind === "refused") {
        return { kind: "not_delivered", country: assessment.country };
      }
      if (assessment.kind === "in_uk") {
        // The address check above already refuses GB; this keeps the types honest.
        throw new DeliveryQuoteRequestRejectedError([
          { field: "country", reason: "united_kingdom" },
        ]);
      }

      const normalised = { ...address, country: assessment.country };
      if (assessment.kind === "fixed") {
        const session = await deps.checkout.createCheckoutOrder({
          ...(input.guest ? { guest: input.guest } : {}),
          subject: input.subject,
          basketId: input.basketId,
          fulfilment: "international_quotation",
          idempotencyKey: input.idempotencyKey,
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
          deliveryAddress: normalised,
          deliveryPhone: input.deliveryPhone,
          outsideUk: {
            country: assessment.country,
            regionId: assessment.regionId,
            pricePence: assessment.pricePence,
          },
        });
        return { kind: "pay_now", session };
      }

      // A request to the gallery is the buyer's first step on a quote that does not exist yet.
      const step = deliveryQuoteTransition(null, "request", "buyer");
      if (!step.allowed) {
        throw new ShopApiError(
          SHOP_API_ERROR_CODES.INTERNAL,
          "A delivery quote cannot be requested",
          500,
        );
      }
      const request = await deps.orders.createQuoteOrder({
        ...(input.guest ? { guest: input.guest } : {}),
        subject: input.subject,
        basketId: input.basketId,
        idempotencyKey: input.idempotencyKey,
        deliveryAddress: normalised,
        deliveryPhone: input.deliveryPhone,
        country: assessment.country,
        regionId: toQuotedRegion(assessment.regionId),
        status: step.next,
        holdUntil: quoteHoldUntil(now()),
        fallbackEmail: input.fallbackEmail,
      });
      return { kind: "quote_requested", request };
    },
  };
}

export type DeliveryQuoteRequestService = ReturnType<typeof createDeliveryQuoteRequestService>;

/** The UK is not a quoted region: it is never assessed here, so it cannot reach this point. */
function toQuotedRegion(id: DeliveryRegionId | null): Exclude<DeliveryRegionId, "uk"> | null {
  return id === "uk" ? null : id;
}
