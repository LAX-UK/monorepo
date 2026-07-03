import type { TelephoneBidBooking } from "@auction/types";
import { err, ok } from "neverthrow";
import { moneyToDbString, parseAuthorizedMaxCap } from "../../lib/telephone-booking.mapper.js";
import type { ITelephoneBidBookingBuyerService } from "../interfaces/telephone-bid-booking-service.js";
import type { TelephoneBidBookingContext } from "./telephone-bid-booking-context.js";
import { notifyBestEffort, publishTelephoneBookingEvent } from "./telephone-booking-events.js";
import {
  EDITABLE_LOT_STATUSES,
  assertBuyerEligible,
  assertMembership,
  assertOnsiteSaleOpen,
  isUniqueViolation,
  resolveProfilePhone,
  telephoneBookingErr,
  validateLotIds,
} from "./telephone-booking-validation.js";

export class TelephoneBidBookingBuyerService implements ITelephoneBidBookingBuyerService {
  constructor(private readonly ctx: TelephoneBidBookingContext) {}

  async requestBooking(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    lotIds?: string[];
    authorizedMax?: number;
    buyerNotes?: string;
  }) {
    const { validationDeps: deps, eventsDeps, repo } = this.ctx;
    const saleCheck = await assertOnsiteSaleOpen(deps, input.saleId);
    if (saleCheck.isErr()) return err(saleCheck.error);

    const buyerCheck = await assertBuyerEligible(deps, input.userId);
    if (buyerCheck.isErr()) return err(buyerCheck.error);

    const memCheck = await assertMembership(deps, input.userId, input.buyerLegalEntityId);
    if (memCheck.isErr()) return err(memCheck.error);

    const phoneCheck = await resolveProfilePhone(deps, input.userId);
    if (phoneCheck.isErr()) return err(phoneCheck.error);

    const lotIds = [...new Set(input.lotIds ?? [])];
    const lotsCheck = await validateLotIds(deps, input.saleId, lotIds);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const existing = await repo.findActiveForSaleUserEntity({
      saleId: input.saleId,
      userId: input.userId,
      buyerLegalEntityId: input.buyerLegalEntityId,
    });
    if (existing) {
      return telephoneBookingErr(
        "You already have an active telephone booking for this sale",
        409,
        "booking_duplicate",
      );
    }

    try {
      const booking = await repo.insert({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        phoneE164: phoneCheck.value,
        lotIds,
        authorizedMax: moneyToDbString(input.authorizedMax),
        buyerNotes: input.buyerNotes?.trim() || null,
      });
      await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.requested", booking);
      notifyBestEffort(eventsDeps, "notifyRequested", (notifier) =>
        notifier.notifyRequested(booking),
      );
      return ok(booking);
    } catch (e) {
      if (isUniqueViolation(e)) {
        return telephoneBookingErr(
          "You already have an active telephone booking for this sale",
          409,
          "booking_duplicate",
        );
      }
      throw e;
    }
  }

  async listMineForUser(userId: string): Promise<TelephoneBidBooking[]> {
    return this.ctx.repo.listMineForUser(userId);
  }

  async findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBooking | null> {
    return this.ctx.repo.findMineForSale(saleId, userId);
  }

  async getDetailForUser(id: string, userId: string) {
    const booking = await this.ctx.repo.findByIdForUser(id, userId);
    if (!booking) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    return ok(await this.ctx.detailReader.enrichForUser(booking));
  }

  async addLotsOfInterest(input: { bookingId: string; userId: string; lotIds: string[] }) {
    const { repo, validationDeps: deps } = this.ctx;
    const found = await repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    if (!EDITABLE_LOT_STATUSES.includes(found.status as (typeof EDITABLE_LOT_STATUSES)[number])) {
      return telephoneBookingErr(
        "Lots cannot be changed in the current booking status",
        400,
        "invalid_status_transition",
      );
    }

    const merged = [...new Set([...found.lotIds, ...input.lotIds])];
    const lotsCheck = await validateLotIds(deps, found.saleId, merged);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await repo.update(input.bookingId, { lotIds: merged });
    if (!updated) {
      return telephoneBookingErr("Could not update booking", 500);
    }
    return ok(updated);
  }

  async requestLimitIncrease(input: { bookingId: string; userId: string; amount: number }) {
    const { repo, eventsDeps } = this.ctx;
    const found = await repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    if (found.status !== "confirmed" && found.status !== "in_progress") {
      return telephoneBookingErr(
        "Limit increases are only allowed for confirmed bookings",
        400,
        "invalid_status_transition",
      );
    }
    if (found.limitIncreaseRequestedAt) {
      return telephoneBookingErr(
        "A limit increase is already pending staff approval",
        409,
        "limit_increase_pending",
      );
    }
    const currentCap = parseAuthorizedMaxCap(found.authorizedMax);
    if (currentCap != null && input.amount <= currentCap) {
      return telephoneBookingErr("New limit must be higher than your current authorization", 400);
    }

    const updated = await repo.update(input.bookingId, {
      limitIncreaseRequestedAt: new Date(),
      limitIncreaseAmount: moneyToDbString(input.amount),
    });
    if (!updated) {
      return telephoneBookingErr("Could not update booking", 500);
    }
    await publishTelephoneBookingEvent(
      eventsDeps,
      "telephone_booking.limit_increase_requested",
      updated,
      { requestedAmount: input.amount },
    );
    return ok(updated);
  }

  async cancelByBuyer(input: { bookingId: string; userId: string; reason?: string }) {
    const { repo, eventsDeps } = this.ctx;
    const found = await repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    if (found.status !== "requested") {
      return telephoneBookingErr(
        "Only pending requests can be cancelled",
        400,
        "invalid_status_transition",
      );
    }

    const updated = await repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.userId,
      cancellationReason: input.reason?.trim() || "buyer_cancelled",
    });
    if (!updated) {
      return telephoneBookingErr("Could not cancel booking", 500);
    }
    await publishTelephoneBookingEvent(eventsDeps, "telephone_booking.cancelled", updated);
    return ok(updated);
  }
}
