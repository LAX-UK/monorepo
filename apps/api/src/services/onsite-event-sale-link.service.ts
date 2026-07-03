import { isSaleroomDeliveryMode } from "@auction/validators";
import type { IOnsiteEventRepository } from "../repositories/interfaces/onsite-event.repository.js";
import type { ISaleRepository } from "../repositories/interfaces/sale.repository.js";
import type { OnsiteEventRsvpServiceError } from "./interfaces/onsite-event-service-errors.js";

/**
 * Cross-domain policy for linking an onsite event to a saleroom sale: the
 * sale must exist, be onsite/hybrid, and not already be claimed by a
 * different event. (Also enforced at the DB level by a partial unique index
 * on `onsite_event.sale_id` — this check exists to return a clean 409
 * instead of a raw constraint-violation error.)
 */
export class OnsiteEventSaleLinkService {
  constructor(
    private readonly eventRepo: IOnsiteEventRepository,
    private readonly sales: ISaleRepository | null,
  ) {}

  async resolveLinkedSaleTitle(saleId: string | null): Promise<string | null> {
    if (!this.sales || !saleId) return null;
    const sale = await this.sales.findById(saleId);
    return sale?.title ?? null;
  }

  async validateLinkedSale(
    saleId: string | null,
    /** Slug of the event being updated, so a sale already linked to itself doesn't self-conflict. */
    excludeSlug?: string,
  ): Promise<OnsiteEventRsvpServiceError | null> {
    if (!saleId) return null;
    if (!this.sales) {
      return {
        message: "Sale link validation is unavailable",
        status: 503,
        code: "sale_validation_unavailable",
      };
    }
    const sale = await this.sales.findById(saleId);
    if (!sale) {
      return { message: "Linked sale not found", status: 404, code: "sale_not_found" };
    }
    if (!isSaleroomDeliveryMode(sale.deliveryMode)) {
      return {
        message: "Linked sale must be onsite or hybrid",
        status: 400,
        code: "sale_not_saleroom",
      };
    }

    const linkedEvent = await this.eventRepo.findBySaleId(saleId);
    if (linkedEvent && linkedEvent.slug !== excludeSlug) {
      return {
        message: `This sale is already linked to the "${linkedEvent.title}" event`,
        status: 409,
        code: "sale_already_linked",
      };
    }

    return null;
  }
}
