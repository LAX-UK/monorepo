import type { ITelephoneBookingUserPhoneReader } from "@auction/persistence/interfaces";
import type { ITelephoneBidBookingRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { TelephoneBidBooking } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { buyerEntityCanBid } from "../../lib/buyer-entity-bid-eligibility.js";
import type { IAmlHoldStore } from "../aml/ports.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import { KycRequiredError } from "../interfaces/kyc-service.js";
import type { TelephoneBidBookingServiceError } from "../interfaces/telephone-bid-booking-service-errors.js";

export const EDITABLE_LOT_STATUSES = ["requested", "confirmed"] as const;

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

export function telephoneBookingErr(
  message: string,
  status: number,
  code?: string,
): Result<never, TelephoneBidBookingServiceError> {
  return err({ message, status, ...(code ? { code } : {}) });
}

export type TelephoneBookingValidationDeps = {
  repo: ITelephoneBidBookingRepository;
  legalEntityRepository: ILegalEntityRepository;
  kycService: IKycService | null;
  amlHoldStore: IAmlHoldStore | null;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  userPhoneReader: ITelephoneBookingUserPhoneReader;
};

export async function assertBuyerEligible(
  deps: TelephoneBookingValidationDeps,
  userId: string,
): Promise<Result<void, TelephoneBidBookingServiceError>> {
  if (deps.kycService?.isConfigured()) {
    try {
      await deps.kycService.enforceThreshold(userId);
    } catch (caught) {
      if (caught instanceof KycRequiredError) {
        return telephoneBookingErr(
          "Complete identity verification before requesting a telephone line",
          402,
          "kyc_required",
        );
      }
      throw caught;
    }
  }
  if (deps.amlHoldStore) {
    const hold = await deps.amlHoldStore.getHold(userId);
    if (hold?.status === "blocked") {
      return telephoneBookingErr(
        "Request is suspended pending compliance review",
        403,
        "aml_blocked",
      );
    }
  }
  return ok(undefined);
}

export async function assertOnsiteSaleOpen(
  deps: TelephoneBookingValidationDeps,
  saleId: string,
): Promise<Result<{ deliveryMode: string; status: string }, TelephoneBidBookingServiceError>> {
  const saleRow = await deps.saleRepo.findById(saleId);
  if (!saleRow) {
    return telephoneBookingErr("Sale not found", 404);
  }
  if (!isSaleroomDeliveryMode(saleRow.deliveryMode)) {
    return telephoneBookingErr(
      "Telephone bidding is only available for in-person and hybrid sales",
      400,
      "onsite_sale_required",
    );
  }
  if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
    return telephoneBookingErr(
      "This sale is not open for telephone requests",
      400,
      "sale_not_open",
    );
  }
  return ok({ deliveryMode: saleRow.deliveryMode, status: saleRow.status });
}

export async function assertMembership(
  deps: TelephoneBookingValidationDeps,
  userId: string,
  buyerLegalEntityId: string,
): Promise<Result<void, TelephoneBidBookingServiceError>> {
  const membership = await deps.legalEntityRepository.findActiveMembership(
    userId,
    buyerLegalEntityId,
  );
  if (!membership) {
    return telephoneBookingErr(
      "Not a member of the selected legal entity",
      403,
      "membership_required",
    );
  }
  const entity = await deps.legalEntityRepository.findById(buyerLegalEntityId);
  if (!entity) {
    return telephoneBookingErr("Legal entity not found", 404);
  }
  if (!buyerEntityCanBid(entity.status)) {
    return telephoneBookingErr("Legal entity is not authorised", 403, "entity_not_authorised");
  }
  return ok(undefined);
}

export async function resolveProfilePhone(
  deps: TelephoneBookingValidationDeps,
  userId: string,
): Promise<Result<string, TelephoneBidBookingServiceError>> {
  const row = await deps.userPhoneReader.findByUserId(userId);
  const phone = row?.phoneNumber?.trim();
  if (!phone) {
    return telephoneBookingErr(
      "Add a mobile number to your profile before requesting a telephone line",
      400,
      "profile_phone_required",
    );
  }
  if (!row?.phoneNumberVerified) {
    return telephoneBookingErr(
      "Verify your mobile number before requesting a telephone line",
      400,
      "profile_phone_unverified",
    );
  }
  return ok(phone);
}

export async function validateLotIds(
  deps: TelephoneBookingValidationDeps,
  saleId: string,
  lotIds: string[],
): Promise<Result<void, TelephoneBidBookingServiceError>> {
  if (lotIds.length === 0) return ok(undefined);
  const rows = await deps.lotRepo.findByIds(lotIds);
  const valid = rows.filter((lot) => lot.saleId === saleId && lot.deletedAt == null);
  if (valid.length !== lotIds.length) {
    return telephoneBookingErr(
      "One or more lots do not belong to this sale",
      400,
      "invalid_lot_ids",
    );
  }
  return ok(undefined);
}

export async function getBookingOrErr(
  deps: TelephoneBookingValidationDeps,
  bookingId: string,
): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
  const booking = await deps.repo.findById(bookingId);
  if (!booking) {
    return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
  }
  return ok(booking);
}

export async function getBookingForSaleOrErr(
  deps: TelephoneBookingValidationDeps,
  bookingId: string,
  saleId: string,
): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
  const found = await getBookingOrErr(deps, bookingId);
  if (found.isErr()) return found;
  if (found.value.saleId !== saleId) {
    return telephoneBookingErr("Telephone booking does not belong to this sale", 400);
  }
  return found;
}
