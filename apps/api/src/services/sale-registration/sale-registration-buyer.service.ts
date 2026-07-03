import { type Result, err, ok } from "neverthrow";
import { memberRequiresSaleRegistration } from "../../lib/sale-registration-policy.js";
import type {
  ISaleRegistrationBuyerService,
  SaleRegistrationRow,
  SaleRegistrationServiceError,
} from "../interfaces/sale-registration-service.js";
import type { SaleRegistrationContext } from "./sale-registration-context.js";
import { toBidLimitString } from "./sale-registration-request.mapper.js";

export class SaleRegistrationBuyerService implements ISaleRegistrationBuyerService {
  constructor(private readonly ctx: SaleRegistrationContext) {}

  async listMineForSale(input: { userId: string; saleId: string }): Promise<SaleRegistrationRow[]> {
    return this.ctx.registrationRepo.listBySaleAndUser(input.saleId, input.userId);
  }

  async requestRegistration(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    bidLimit?: number | undefined;
  }): Promise<Result<SaleRegistrationRow, SaleRegistrationServiceError>> {
    const saleRow = await this.ctx.saleRepo.findById(input.saleId);
    if (!saleRow) {
      return err({ message: "Sale not found", status: 404 });
    }
    if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
      return err({
        message: "This sale is not open for bidder registration",
        status: 400,
        code: "sale_not_registerable",
      });
    }

    const membership = await this.ctx.legalEntityRepository.findActiveMembership(
      input.userId,
      input.buyerLegalEntityId,
    );
    if (!membership) {
      return err({ message: "Not a member of the selected legal entity", status: 403 });
    }

    if (!memberRequiresSaleRegistration(membership.role)) {
      return err({
        message: "Sale registration is not required for this membership",
        status: 400,
        code: "no_registration_required",
      });
    }

    const entity = await this.ctx.legalEntityRepository.findById(input.buyerLegalEntityId);
    if (!entity) {
      return err({ message: "Legal entity not found", status: 404 });
    }
    if (entity.status !== "approved" && entity.status !== "restricted") {
      return err({
        message: "Legal entity is not authorised to register for bidding",
        status: 403,
        code: "entity_not_authorised",
      });
    }

    const bidLimitStr = toBidLimitString(input.bidLimit);

    const existing = await this.ctx.registrationRepo.findBySaleUserEntity(
      input.saleId,
      input.userId,
      input.buyerLegalEntityId,
    );

    if (existing) {
      if (existing.status === "approved" || existing.status === "pending") {
        return ok(existing);
      }
      const updated = await this.ctx.registrationRepo.reactivateToPending(existing.id, bidLimitStr);
      if (!updated) {
        return err({ message: "Could not update sale registration", status: 500 });
      }
      return ok(updated);
    }

    const inserted = await this.ctx.registrationRepo.insert({
      saleId: input.saleId,
      userId: input.userId,
      buyerLegalEntityId: input.buyerLegalEntityId,
      bidLimit: bidLimitStr,
    });

    if (!inserted) {
      return err({ message: "Could not create sale registration", status: 500 });
    }
    return ok(inserted);
  }
}
