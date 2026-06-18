import type { Database } from "@auction/db";
import { lotNotDeleted, saleNotDeleted } from "@auction/db";
import { bid, lot, sale, user } from "@auction/db/schema";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";
import { and, eq, inArray } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { buyerEntityCanBid } from "../lib/buyer-entity-bid-eligibility.js";
import { moneyToDbString, parseAuthorizedMaxCap } from "../lib/telephone-booking.mapper.js";
import type { ITelephoneBidBookingRepository } from "../repositories/interfaces/telephone-bid-booking.repository.js";
import type { IAmlHoldStore } from "./aml/ports.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";
import type { IKycService } from "./interfaces/kyc-service.js";
import { KycRequiredError } from "./interfaces/kyc-service.js";
import type { ILegalEntityRepository } from "./interfaces/legal-entity-repository.js";
import type {
  ITelephoneBidBookingService,
  TelephoneBidBookingDetail,
  TelephoneBidBookingServiceError,
} from "./interfaces/telephone-bid-booking-service.js";
import type { ITelephoneBookingNotifier } from "./interfaces/telephone-booking-notifier.js";

export type { TelephoneBidBookingServiceError } from "./interfaces/telephone-bid-booking-service.js";

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23505";
}

const EDITABLE_LOT_STATUSES = ["requested", "confirmed"] as const;

export class TelephoneBidBookingService implements ITelephoneBidBookingService {
  constructor(
    private readonly db: Database,
    private readonly repo: ITelephoneBidBookingRepository,
    private readonly legalEntityRepository: ILegalEntityRepository,
    private readonly kycService: IKycService | null = null,
    private readonly amlHoldStore: IAmlHoldStore | null = null,
    private readonly domainEventPublisher: DomainEventPublisher | null = null,
    private readonly notifier: ITelephoneBookingNotifier | null = null,
  ) {}

  private notifyBestEffort(
    _label: string,
    fn: (notifier: ITelephoneBookingNotifier) => Promise<void>,
  ): void {
    const notifier = this.notifier;
    if (!notifier) return;
    void fn(notifier).catch(() => undefined);
  }

  private err(
    message: string,
    status: number,
    code?: string,
  ): Result<never, TelephoneBidBookingServiceError> {
    return err({ message, status, ...(code ? { code } : {}) });
  }

  private async publish(
    eventType: string,
    booking: TelephoneBidBooking,
    extra?: object,
  ): Promise<void> {
    if (!this.domainEventPublisher) return;
    await this.domainEventPublisher.publish(this.db, {
      eventType,
      aggregateType: "telephone_bid_booking",
      aggregateId: booking.id,
      payload: {
        saleId: booking.saleId,
        userId: booking.userId,
        status: booking.status,
        ...extra,
      },
    });
  }

  private async assertBuyerEligible(
    userId: string,
  ): Promise<Result<void, TelephoneBidBookingServiceError>> {
    if (this.kycService?.isConfigured()) {
      try {
        await this.kycService.enforceThreshold(userId);
      } catch (caught) {
        if (caught instanceof KycRequiredError) {
          return this.err(
            "Complete identity verification before requesting a telephone line",
            402,
            "kyc_required",
          );
        }
        throw caught;
      }
    }
    if (this.amlHoldStore) {
      const hold = await this.amlHoldStore.getHold(userId);
      if (hold?.status === "blocked") {
        return this.err("Request is suspended pending compliance review", 403, "aml_blocked");
      }
    }
    return ok(undefined);
  }

  private async assertOnsiteSaleOpen(
    saleId: string,
  ): Promise<Result<{ deliveryMode: string; status: string }, TelephoneBidBookingServiceError>> {
    const [saleRow] = await this.db
      .select({
        deliveryMode: sale.deliveryMode,
        status: sale.status,
      })
      .from(sale)
      .where(and(eq(sale.id, saleId), saleNotDeleted()))
      .limit(1);
    if (!saleRow) {
      return this.err("Sale not found", 404);
    }
    if (!isSaleroomDeliveryMode(saleRow.deliveryMode)) {
      return this.err(
        "Telephone bidding is only available for in-person and hybrid sales",
        400,
        "onsite_sale_required",
      );
    }
    if (saleRow.status !== "scheduled" && saleRow.status !== "active") {
      return this.err("This sale is not open for telephone requests", 400, "sale_not_open");
    }
    return ok(saleRow);
  }

  private async assertMembership(
    userId: string,
    buyerLegalEntityId: string,
  ): Promise<Result<void, TelephoneBidBookingServiceError>> {
    const membership = await this.legalEntityRepository.findActiveMembership(
      userId,
      buyerLegalEntityId,
    );
    if (!membership) {
      return this.err("Not a member of the selected legal entity", 403, "membership_required");
    }
    const entity = await this.legalEntityRepository.findById(buyerLegalEntityId);
    if (!entity) {
      return this.err("Legal entity not found", 404);
    }
    if (!buyerEntityCanBid(entity.status)) {
      return this.err("Legal entity is not authorised", 403, "entity_not_authorised");
    }
    return ok(undefined);
  }

  private async resolveProfilePhone(
    userId: string,
  ): Promise<Result<string, TelephoneBidBookingServiceError>> {
    const [row] = await this.db
      .select({ mobile: user.mobile })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const mobile = row?.mobile?.trim();
    if (!mobile) {
      return this.err(
        "Add a mobile number to your profile before requesting a telephone line",
        400,
        "profile_phone_required",
      );
    }
    return ok(mobile);
  }

  private async validateLotIds(
    saleId: string,
    lotIds: string[],
  ): Promise<Result<void, TelephoneBidBookingServiceError>> {
    if (lotIds.length === 0) return ok(undefined);
    const rows = await this.db
      .select({ id: lot.id })
      .from(lot)
      .where(and(eq(lot.saleId, saleId), inArray(lot.id, lotIds), lotNotDeleted()));
    if (rows.length !== lotIds.length) {
      return this.err("One or more lots do not belong to this sale", 400, "invalid_lot_ids");
    }
    return ok(undefined);
  }

  private async getBookingOrErr(
    bookingId: string,
  ): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const booking = await this.repo.findById(bookingId);
    if (!booking) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
    }
    return ok(booking);
  }

  private async getBookingForSaleOrErr(
    bookingId: string,
    saleId: string,
  ): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(bookingId);
    if (found.isErr()) return found;
    if (found.value.saleId !== saleId) {
      return this.err("Telephone booking does not belong to this sale", 400);
    }
    return found;
  }

  async requestBooking(input: {
    userId: string;
    saleId: string;
    buyerLegalEntityId: string;
    lotIds?: string[];
    authorizedMax?: number;
    buyerNotes?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const saleCheck = await this.assertOnsiteSaleOpen(input.saleId);
    if (saleCheck.isErr()) return err(saleCheck.error);

    const buyerCheck = await this.assertBuyerEligible(input.userId);
    if (buyerCheck.isErr()) return err(buyerCheck.error);

    const memCheck = await this.assertMembership(input.userId, input.buyerLegalEntityId);
    if (memCheck.isErr()) return err(memCheck.error);

    const phoneCheck = await this.resolveProfilePhone(input.userId);
    if (phoneCheck.isErr()) return err(phoneCheck.error);

    const lotIds = [...new Set(input.lotIds ?? [])];
    const lotsCheck = await this.validateLotIds(input.saleId, lotIds);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const existing = await this.repo.findActiveForSaleUserEntity({
      saleId: input.saleId,
      userId: input.userId,
      buyerLegalEntityId: input.buyerLegalEntityId,
    });
    if (existing) {
      return this.err(
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
      await this.publish("telephone_booking.requested", booking);
      this.notifyBestEffort("notifyRequested", (notifier) => notifier.notifyRequested(booking));
      return ok(booking);
    } catch (e) {
      if (isUniqueViolation(e)) {
        return this.err(
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

  async getDetailForUser(
    id: string,
    userId: string,
  ): Promise<Result<TelephoneBidBookingDetail, TelephoneBidBookingServiceError>> {
    const booking = await this.repo.findByIdForUser(id, userId);
    if (!booking) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
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
    });
  }

  async addLotsOfInterest(input: {
    bookingId: string;
    userId: string;
    lotIds: string[];
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
    }
    if (!EDITABLE_LOT_STATUSES.includes(found.status as (typeof EDITABLE_LOT_STATUSES)[number])) {
      return this.err(
        "Lots cannot be changed in the current booking status",
        400,
        "invalid_status_transition",
      );
    }

    const merged = [...new Set([...found.lotIds, ...input.lotIds])];
    const lotsCheck = await this.validateLotIds(found.saleId, merged);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await this.repo.update(input.bookingId, { lotIds: merged });
    if (!updated) {
      return this.err("Could not update booking", 500);
    }
    return ok(updated);
  }

  async requestLimitIncrease(input: {
    bookingId: string;
    userId: string;
    amount: number;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
    }
    if (found.status !== "confirmed" && found.status !== "in_progress") {
      return this.err(
        "Limit increases are only allowed for confirmed bookings",
        400,
        "invalid_status_transition",
      );
    }
    if (found.limitIncreaseRequestedAt) {
      return this.err(
        "A limit increase is already pending staff approval",
        409,
        "limit_increase_pending",
      );
    }
    const currentCap = parseAuthorizedMaxCap(found.authorizedMax);
    if (currentCap != null && input.amount <= currentCap) {
      return this.err("New limit must be higher than your current authorization", 400);
    }

    const updated = await this.repo.update(input.bookingId, {
      limitIncreaseRequestedAt: new Date(),
      limitIncreaseAmount: moneyToDbString(input.amount),
    });
    if (!updated) {
      return this.err("Could not update booking", 500);
    }
    await this.publish("telephone_booking.limit_increase_requested", updated, {
      requestedAmount: input.amount,
    });
    return ok(updated);
  }

  async cancelByBuyer(input: {
    bookingId: string;
    userId: string;
    reason?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.repo.findByIdForUser(input.bookingId, input.userId);
    if (!found) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
    }
    if (found.status !== "requested") {
      return this.err("Only pending requests can be cancelled", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.userId,
      cancellationReason: input.reason?.trim() || "buyer_cancelled",
    });
    if (!updated) {
      return this.err("Could not cancel booking", 500);
    }
    await this.publish("telephone_booking.cancelled", updated);
    return ok(updated);
  }

  async listForSaleAdmin(saleId: string, status?: TelephoneBidBookingStatus) {
    return this.repo.listForSaleAdmin(saleId, status);
  }

  async listForCurrentLot(saleId: string, lotId: string) {
    return this.repo.listForCurrentLot(saleId, lotId);
  }

  async confirm(input: {
    bookingId: string;
    staffUserId: string;
    notes?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "requested") {
      return this.err("Only requested bookings can be confirmed", 400, "invalid_status_transition");
    }

    const now = new Date();
    const updated = await this.repo.update(input.bookingId, {
      status: "confirmed",
      confirmedAt: now,
      approvedByUserId: input.staffUserId,
      ...(input.notes !== undefined ? { notes: input.notes.trim() } : {}),
    });
    if (!updated) {
      return this.err("Could not confirm booking", 500);
    }
    await this.publish("telephone_booking.confirmed", updated);
    this.notifyBestEffort("notifyConfirmed", (notifier) => notifier.notifyConfirmed(updated));
    return ok(updated);
  }

  async assignClerk(input: {
    bookingId: string;
    staffUserId: string;
    clerkUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return this.err("Cannot assign clerk to a closed booking", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      clerkUserId: input.clerkUserId,
    });
    if (!updated) {
      return this.err("Could not assign clerk", 500);
    }
    return ok(updated);
  }

  async updateNotes(input: {
    bookingId: string;
    staffUserId: string;
    notes: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;

    const updated = await this.repo.update(input.bookingId, {
      notes: input.notes.trim(),
    });
    if (!updated) {
      return this.err("Could not update notes", 500);
    }
    return ok(updated);
  }

  async approveLimitIncrease(input: {
    bookingId: string;
    staffUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (!found.value.limitIncreaseRequestedAt || !found.value.limitIncreaseAmount) {
      return this.err("No pending limit increase request", 400);
    }

    const updated = await this.repo.update(input.bookingId, {
      authorizedMax: found.value.limitIncreaseAmount,
      limitIncreaseRequestedAt: null,
      limitIncreaseAmount: null,
    });
    if (!updated) {
      return this.err("Could not approve limit increase", 500);
    }
    await this.publish("telephone_booking.limit_increase_approved", updated);
    this.notifyBestEffort("notifyLimitIncreaseApproved", (notifier) =>
      notifier.notifyLimitIncreaseApproved(updated),
    );
    return ok(updated);
  }

  async startLine(input: {
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "confirmed" && found.value.status !== "in_progress") {
      return this.err(
        "Booking must be confirmed before starting a line",
        400,
        "invalid_status_transition",
      );
    }

    const lotsCheck = await this.validateLotIds(found.value.saleId, [input.lotId]);
    if (lotsCheck.isErr()) return err(lotsCheck.error);

    const updated = await this.repo.update(input.bookingId, {
      status: "in_progress",
    });
    if (!updated) {
      return this.err("Could not start telephone line", 500);
    }
    await this.publish("telephone_booking.line_started", updated, { lotId: input.lotId });
    return ok(updated);
  }

  async completeLine(input: {
    bookingId: string;
    staffUserId: string;
    lotId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status !== "in_progress") {
      return this.err("No active telephone line to complete", 400, "invalid_status_transition");
    }

    const completedLotIds = [...new Set([...found.value.completedLotIds, input.lotId])];
    const updated = await this.repo.update(input.bookingId, {
      status: "confirmed",
      completedLotIds,
    });
    if (!updated) {
      return this.err("Could not complete telephone line", 500);
    }
    await this.publish("telephone_booking.line_completed", updated, { lotId: input.lotId });
    return ok(updated);
  }

  async closeBooking(input: {
    bookingId: string;
    staffUserId: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return this.err("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      status: "completed",
    });
    if (!updated) {
      return this.err("Could not close booking", 500);
    }
    await this.publish("telephone_booking.closed", updated);
    return ok(updated);
  }

  async cancelByStaff(input: {
    bookingId: string;
    staffUserId: string;
    reason?: string;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const found = await this.getBookingOrErr(input.bookingId);
    if (found.isErr()) return found;
    if (found.value.status === "cancelled" || found.value.status === "completed") {
      return this.err("Booking is already closed", 400, "invalid_status_transition");
    }

    const updated = await this.repo.update(input.bookingId, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledByUserId: input.staffUserId,
      cancellationReason: input.reason?.trim() || "staff_cancelled",
    });
    if (!updated) {
      return this.err("Could not cancel booking", 500);
    }
    await this.publish("telephone_booking.cancelled", updated);
    this.notifyBestEffort("notifyCancelledByStaff", (notifier) =>
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

  async assertBookingBelongsToSale(
    bookingId: string,
    saleId: string,
  ): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    return this.getBookingForSaleOrErr(bookingId, saleId);
  }

  async assertBookingAllowsTelephoneBid(input: {
    bookingId: string;
    saleId: string;
    lotId: string;
    amount: number;
    maxAutoBidAmount?: number;
  }): Promise<Result<TelephoneBidBooking, TelephoneBidBookingServiceError>> {
    const booking = await this.repo.findById(input.bookingId);
    if (!booking) {
      return this.err("Telephone booking not found", 404, "booking_not_found");
    }
    if (booking.saleId !== input.saleId) {
      return this.err("Telephone booking does not belong to this sale", 400);
    }
    if (booking.status !== "confirmed" && booking.status !== "in_progress") {
      return this.err("Telephone booking is not active", 400, "invalid_status_transition");
    }
    if (booking.lotIds.length > 0 && !booking.lotIds.includes(input.lotId)) {
      return this.err("This lot is not part of the telephone booking", 400, "lot_not_in_booking");
    }

    const cap = parseAuthorizedMaxCap(booking.authorizedMax);
    const effective =
      input.maxAutoBidAmount != null && Number.isFinite(input.maxAutoBidAmount)
        ? Math.max(input.amount, input.maxAutoBidAmount)
        : input.amount;
    if (cap != null && effective > cap + 1e-9) {
      return this.err("Bid exceeds authorized telephone limit", 403, "authorized_max_exceeded");
    }

    return ok(booking);
  }
}
