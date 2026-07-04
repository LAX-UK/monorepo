import type { ISaleRegistrationCheckInReader } from "@auction/persistence";
import type { ILegalEntityRepository } from "@auction/persistence";
import type { SaleDeliveryMode } from "@auction/types";
import { PADDLE_NUMBER_MIN, saleAllowsInRoomCheckIn } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { buyerEntityCanBid } from "../lib/buyer-entity-bid-eligibility.js";
import { memberEligibleForStaffInRoomCheckIn } from "../lib/sale-registration-policy.js";
import type { SaleroomCheckInServiceError } from "./interfaces/saleroom-check-in-service.js";

export class SaleroomCheckInEligibilityValidator {
  constructor(
    private readonly reader: ISaleRegistrationCheckInReader,
    private readonly legalEntityRepository: ILegalEntityRepository,
  ) {}

  private serviceErr(
    message: string,
    status: number,
    code?: string,
  ): Result<never, SaleroomCheckInServiceError> {
    return err({ message, status, ...(code ? { code } : {}) });
  }

  async validate(input: {
    saleId: string;
    userId: string;
    buyerLegalEntityId: string;
    assignPaddle?: boolean;
    paddleNumber?: number | undefined;
  }): Promise<Result<void, SaleroomCheckInServiceError>> {
    const saleRow = await this.reader.findSaleForCheckIn(input.saleId);
    if (!saleRow) {
      return this.serviceErr("Sale not found", 404);
    }
    if (!saleAllowsInRoomCheckIn(saleRow.deliveryMode as SaleDeliveryMode)) {
      return this.serviceErr(
        "Check-in is only available for onsite or hybrid sales",
        400,
        "sale_not_saleroom",
      );
    }
    if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
      return this.serviceErr("This sale is not open for check-in", 400, "sale_not_registerable");
    }

    const userRow = await this.reader.findUserForCheckIn(input.userId);
    if (!userRow) {
      return this.serviceErr("User not found", 404);
    }
    if (userRow.suspendedAt != null) {
      return this.serviceErr("User account is suspended", 403, "user_suspended");
    }
    if (userRow.kycStatus !== "approved") {
      return this.serviceErr("Complete identity verification before check-in", 402, "kyc_required");
    }
    if (!userRow.emailVerified) {
      return this.serviceErr("Email address must be verified", 400, "email_not_verified");
    }

    const membership = await this.legalEntityRepository.findActiveMembership(
      input.userId,
      input.buyerLegalEntityId,
    );
    if (!membership) {
      return this.serviceErr(
        "Not a member of the selected legal entity",
        403,
        "membership_required",
      );
    }

    const entity = await this.legalEntityRepository.findById(input.buyerLegalEntityId);
    if (!entity) {
      return this.serviceErr("Legal entity not found", 404);
    }
    if (!buyerEntityCanBid(entity.status)) {
      return this.serviceErr("Legal entity is not authorised to bid", 403, "entity_not_authorised");
    }

    if (!memberEligibleForStaffInRoomCheckIn(membership.role, entity.kind)) {
      return this.serviceErr(
        "This membership is not eligible for in-room check-in",
        400,
        "not_eligible_for_check_in",
      );
    }

    if (
      input.assignPaddle !== false &&
      input.paddleNumber != null &&
      (!Number.isInteger(input.paddleNumber) || input.paddleNumber < PADDLE_NUMBER_MIN)
    ) {
      return this.serviceErr(
        `Paddle number must be at least ${PADDLE_NUMBER_MIN}`,
        400,
        "invalid_paddle",
      );
    }

    return ok(undefined);
  }
}
