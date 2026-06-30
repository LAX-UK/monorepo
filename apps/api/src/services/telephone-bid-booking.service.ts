import type { Database } from "@auction/db";
import { bid, sale } from "@auction/db/schema";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import { eq } from "drizzle-orm";
import { err, ok } from "neverthrow";
import { moneyToDbString, parseAuthorizedMaxCap } from "../lib/telephone-booking.mapper.js";
import type { ITelephoneBidBookingRepository } from "../repositories/interfaces/telephone-bid-booking.repository.js";
import type { IAmlHoldStore } from "./aml/ports.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IKycService } from "./interfaces/kyc-service.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type {
  ITelephoneBidBookingService,
  TelephoneBidBookingDetail,
} from "./interfaces/telephone-bid-booking-service.js";
import type { ITelephoneBookingNotifier } from "./interfaces/telephone-booking-notifier.js";
import {
  type TelephoneBookingEventsDeps,
  notifyBestEffort,
  publishTelephoneBookingEvent,
} from "./telephone-booking/telephone-booking-events.js";
import {
  EDITABLE_LOT_STATUSES,
  type TelephoneBookingValidationDeps,
  assertBuyerEligible,
  assertMembership,
  assertOnsiteSaleOpen,
  getBookingForSaleOrErr,
  getBookingOrErr,
  isUniqueViolation,
  resolveProfilePhone,
  telephoneBookingErr,
  validateLotIds,
} from "./telephone-booking/telephone-booking-validation.js";

export type { TelephoneBidBookingServiceError } from "./interfaces/telephone-bid-booking-service.js";

export class TelephoneBidBookingService implements ITelephoneBidBookingService {
  private readonly validationDeps: TelephoneBookingValidationDeps;
  private readonly eventsDeps: TelephoneBookingEventsDeps;

  constructor(
    private readonly db: Database,
    private readonly repo: ITelephoneBidBookingRepository,
    legalEntityRepository: ILegalEntityRepository,
    kycService: IKycService | null = null,
    amlHoldStore: IAmlHoldStore | null = null,
    domainEventPublisher: DomainEventPublisher | null = null,
    notifier: ITelephoneBookingNotifier | null = null,
  ) {
    this.validationDeps = {
      db,
      repo,
      legalEntityRepository,
      kycService,
      amlHoldStore,
    };
    this.eventsDeps = {
      db,
      domainEventPublisher,
      notifier,
    };
  }

  async requestBooking(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    lotIds?: string[];
    authorizedMax?: number;
    buyerNotes?: string;
  }) {
    const saleCheck = await assertOnsiteSaleOpen(this.validationDeps, input.saleId);
    if (saleCheck.isErr()) return err(saleCheck.error);

    const buyerCheck = await assertBuyerEligible(this.validationDeps, input.userId);
    if (buyerCheck.isErr()) return err(buyerCheck.error);

    const memCheck = await assertMembership(
      this.validationDeps,
      input.userId,
      input.buyerLegalEntityId,
    );
    if (memCheck.isErr()) return err(memCheck.error);

    const phoneCheck = await resolveProfilePhone(this.validationDeps, input.userId);
    if (phoneCheck.isErr()) return err(phoneCheck.error);

    const lotIds = [...new Set(input.lotIds ?? [])];
    const lotsCheck = await validateLotIds(this.validationDeps, input.saleId, lotIds);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const existing = await this.repo.findActiveForSaleUserEntity({
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
      const booking = await this.repo.insert({
        saleId: input.saleId,
        userId: input.userId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        phoneE164: phoneCheck.value,
        lotIds,
        authorizedMax: moneyToDbString(input.authorizedMax),
        buyerNotes: input.buyerNotes?.trim() || null,
      });
      await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.requested", booking);
      notifyBestEffort(this.eventsDeps, "notifyRequested", (notifier) =>
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
    return this.repo.listMineForUser(userId);
  }

  async findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBooking | null> {
    return this.repo.findMineForSale(saleId, userId);
  }

  async getDetailForUser(id: string, userId: string) {
    const booking = await this.repo.findByIdForUser(id, userId);
    if (!booking) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }

    const [saleRow] = await this.db
      .select({ title: sale.title })
      .from(sale)
      .where(eq(sale.id, booking.saleId))
      .limit(1);

    const bidRows = await this.db
      .select({
        id: bid.id,
        lotId: bid.lotId,
        amount: bid.amount,
        isWinning: bid.isWinning,
        createdAt: bid.createdAt,
      })
      .from(bid)
      .where(eq(bid.telephoneBookingId, booking.id));

    return ok({
      ...booking,
      saleTitle: saleRow?.title ?? null,
      linkedBids: bidRows.map((r) => ({
        id: r.id,
        lotId: r.lotId,
        amount: String(r.amount),
        isWinning: r.isWinning,
        createdAt: r.createdAt,
      })),
    } satisfies TelephoneBidBookingDetail);
  }

  async addLotsOfInterest(input: { bookingId: string; userId: string; lotIds: string[] }) {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
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
    const lotsCheck = await validateLotIds(this.validationDeps, found.saleId, merged);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await this.repo.update(input.bookingId, { lotIds: merged });
    if (!updated) {
      return telephoneBookingErr("Could not update booking", 500);
    }
    return ok(updated);
  }

  async requestLimitIncrease(input: { bookingId: string; userId: string; amount: number }) {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
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

    const updated = await this.repo.update(input.bookingId, {
      limitIncreaseRequestedAt: new Date(),
      limitIncreaseAmount: moneyToDbString(input.amount),
    });
    if (!updated) {
      return telephoneBookingErr("Could not update booking", 500);
    }
    await publishTelephoneBookingEvent(
      this.eventsDeps,
      "telephone_booking.limit_increase_requested",
      updated,
      { requestedAmount: input.amount },
    );
    return ok(updated);
  }

  async cancelByBuyer(input: { bookingId: string; userId: string; reason?: string }) {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
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

    const updated = await this.repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.userId,
      cancellationReason: input.reason?.trim() || "buyer_cancelled",
    });
    if (!updated) {
      return telephoneBookingErr("Could not cancel booking", 500);
    }
    await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.cancelled", updated);
    return ok(updated);
  }

  async listForSaleAdmin(saleId: string, status?: TelephoneBidBookingStatus) {
    return this.repo.listForSaleAdmin(saleId, status);
  }

  async listForCurrentLot(saleId: string, lotId: string) {
    return this.repo.listForCurrentLot(saleId, lotId);
  }

  async confirm(input: { bookingId: string; staffUserId: string; notes?: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "requested") {
      return telephoneBookingErr(
        "Only requested bookings can be confirmed",
        400,
        "invalid_status_transition",
      );
    }

    const now = new Date();
    const updated = await this.repo.update(input.bookingId, {
      status: "confirmed",
      confirmedAt: now,
      approvedByUserId: input.staffUserId,
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
    });
    if (!updated) {
      return telephoneBookingErr("Could not confirm booking", 500);
    }
    await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.confirmed", updated);
    notifyBestEffort(this.eventsDeps, "notifyConfirmed", (notifier) =>
      notifier.notifyConfirmed(updated),
    );
    return ok(updated);
  }

  async assignClerk(input: { bookingId: string; staffUserId: string; clerkUserId: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr(
        "Cannot assign clerk to a closed booking",
        400,
        "invalid_status_transition",
      );
    }

    const updated = await this.repo.update(input.bookingId, {
      clerkUserId: input.clerkUserId,
    });
    if (!updated) {
      return telephoneBookingErr("Could not assign clerk", 500);
    }
    return ok(updated);
  }

  async updateNotes(input: { bookingId: string; staffUserId: string; notes: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;

    const updated = await this.repo.update(input.bookingId, {
      notes: input.notes.trim(),
    });
    if (!updated) {
      return telephoneBookingErr("Could not update notes", 500);
    }
    return ok(updated);
  }

  async approveLimitIncrease(input: { bookingId: string; staffUserId: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (!found.value.limitIncreaseRequestedAt || !found.value.limitIncreaseAmount) {
      return telephoneBookingErr("No pending limit increase request", 400);
    }

    const updated = await this.repo.update(input.bookingId, {
      authorizedMax: found.value.limitIncreaseAmount,
      limitIncreaseRequestedAt: null,
      limitIncreaseAmount: null,
    });
    if (!updated) {
      return telephoneBookingErr("Could not approve limit increase", 500);
    }
    await publishTelephoneBookingEvent(
      this.eventsDeps,
      "telephone_booking.limit_increase_approved",
      updated,
    );
    notifyBestEffort(this.eventsDeps, "notifyLimitIncreaseApproved", (notifier) =>
      notifier.notifyLimitIncreaseApproved(updated),
    );
    return ok(updated);
  }

  async startLine(input: { bookingId: string; staffUserId: string; lotId: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "confirmed" && found.value.status !== "in_progress") {
      return telephoneBookingErr(
        "Booking must be confirmed before starting a line",
        400,
        "invalid_status_transition",
      );
    }

    const lotsCheck = await validateLotIds(this.validationDeps, found.value.saleId, [input.lotId]);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await this.repo.update(input.bookingId, {
      status: "in_progress",
    });
    if (!updated) {
      return telephoneBookingErr("Could not start telephone line", 500);
    }
    await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.line_started", updated, {
      lotId: input.lotId,
    });
    return ok(updated);
  }

  async completeLine(input: { bookingId: string; staffUserId: string; lotId: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "in_progress") {
      return telephoneBookingErr(
        "No active telephone line to complete",
        400,
        "invalid_status_transition",
      );
    }

    const completedLotIds = [...new Set([...found.value.completedLotIds, input.lotId])];
    const updated = await this.repo.update(input.bookingId, {
      status: "confirmed",
      completedLotIds,
    });
    if (!updated) {
      return telephoneBookingErr("Could not complete telephone line", 500);
    }
    await publishTelephoneBookingEvent(
      this.eventsDeps,
      "telephone_booking.line_completed",
      updated,
      {
        lotId: input.lotId,
      },
    );
    return ok(updated);
  }

  async closeBooking(input: { bookingId: string; staffUserId: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      status: "completed",
    });
    if (!updated) {
      return telephoneBookingErr("Could not close booking", 500);
    }
    await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.closed", updated);
    return ok(updated);
  }

  async cancelByStaff(input: { bookingId: string; staffUserId: string; reason?: string }) {
    const found = await getBookingOrErr(this.validationDeps, input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return telephoneBookingErr("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.staffUserId,
      cancellationReason: input.reason?.trim() || "staff_cancelled",
    });
    if (!updated) {
      return telephoneBookingErr("Could not cancel booking", 500);
    }
    await publishTelephoneBookingEvent(this.eventsDeps, "telephone_booking.cancelled", updated);
    notifyBestEffort(this.eventsDeps, "notifyCancelledByStaff", (notifier) =>
      notifier.notifyCancelledByStaff(updated, input.reason),
    );
    return ok(updated);
  }

  async closeAllOpenForSale(saleId: string): Promise<number> {
    return this.repo.closeAllOpenForSale(saleId);
  }

  async completeLinesForLot(saleId: string, lotId: string): Promise<number> {
    return this.repo.completeLinesForLot(saleId, lotId);
  }

  async removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number> {
    return this.repo.removeLotFromActiveBookings(saleId, lotId);
  }

  async countPendingForSale(saleId: string): Promise<number> {
    return this.repo.countBySaleStatus(saleId, "requested");
  }

  async countGlobalPending(): Promise<number> {
    return this.repo.countGlobalByStatus("requested");
  }

  async assertBookingBelongsToSale(bookingId: string, saleId: string) {
    return getBookingForSaleOrErr(this.validationDeps, bookingId, saleId);
  }

  async assertBookingAllowsTelephoneBid(input: {
    bookingId: string;
    saleId: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
  }) {
    const booking = await this.repo.findById(input.bookingId);
    if (!booking) {
      return telephoneBookingErr("Telephone booking not found", 404, "booking_not_found");
    }
    if (booking.saleId !== input.saleId) {
      return telephoneBookingErr("Telephone booking does not belong to this sale", 400);
    }
    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      return telephoneBookingErr(
        "Telephone booking is not active",
        400,
        "invalid_status_transition",
      );
    }
    if (booking.lotIds.length > 0 && !booking.lotIds.includes(input.lotId)) {
      return telephoneBookingErr(
        "This lot is not part of the telephone booking",
        400,
        "lot_not_in_booking",
      );
    }

    const cap = parseAuthorizedMaxCap(booking.authorizedMax);
    const effective =
      input.maxAutoBidAmount != null && Number.isFinite(input.maxAutoBidAmount)
        ? Math.max(input.amount, input.maxAutoBidAmount)
        : input.amount;
    if (cap != null && effective > cap + 1e-9) {
      return telephoneBookingErr(
        "Bid exceeds authorized telephone limit",
        403,
        "authorized_max_exceeded",
      );
    }

    return ok(booking);
  }
}
