import type { ITelephoneBookingUserPhoneReader } from "@auction/persistence/interfaces";
import type { ITelephoneBidBookingDetailReader } from "@auction/persistence/interfaces";
import type { ITelephoneBidBookingRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository, ISaleRepository } from "@auction/persistence/interfaces";
import type { TelephoneBidBooking, TelephoneBidBookingStatus } from "@auction/types";
import type { IAmlHoldStore } from "./aml/ports.js";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IKycService } from "./interfaces/kyc-service.js";
import type { ITelephoneBidBookingService } from "./interfaces/telephone-bid-booking-service.js";
import type { ITelephoneBookingNotifier } from "./interfaces/telephone-booking-notifier.js";
import { TelephoneBidBookingBidPolicyService } from "./telephone-booking/telephone-bid-booking-bid-policy.service.js";
import { TelephoneBidBookingBuyerService } from "./telephone-booking/telephone-bid-booking-buyer.service.js";
import { createTelephoneBidBookingContext } from "./telephone-booking/telephone-bid-booking-context.js";
import { TelephoneBidBookingQueryService } from "./telephone-booking/telephone-bid-booking-query.service.js";
import { TelephoneBidBookingSaleroomBridgeService } from "./telephone-booking/telephone-bid-booking-saleroom-bridge.service.js";
import { TelephoneBidBookingStaffService } from "./telephone-booking/telephone-bid-booking-staff.service.js";

export type { TelephoneBidBookingServiceError } from "./interfaces/telephone-bid-booking-service-errors.js";

export type TelephoneBidBookingServiceDeps = {
  repo: ITelephoneBidBookingRepository;
  detailReader: ITelephoneBidBookingDetailReader;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  userPhoneReader: ITelephoneBookingUserPhoneReader;
  legalEntityRepository: ILegalEntityRepository;
  kycService?: IKycService | null;
  amlHoldStore?: IAmlHoldStore | null;
  domainEventSink?: IDomainEventSink | null;
  notifier?: ITelephoneBookingNotifier | null;
};

/** Container/test wiring: builds sub-services from ports; only construction site for `new TelephoneBid*`. */
export function buildTelephoneBidBookingService(
  deps: TelephoneBidBookingServiceDeps,
): TelephoneBidBookingService {
  const ctx = createTelephoneBidBookingContext({
    repo: deps.repo,
    detailReader: deps.detailReader,
    saleRepo: deps.saleRepo,
    lotRepo: deps.lotRepo,
    userPhoneReader: deps.userPhoneReader,
    legalEntityRepository: deps.legalEntityRepository,
    kycService: deps.kycService ?? null,
    amlHoldStore: deps.amlHoldStore ?? null,
    domainEventSink: deps.domainEventSink ?? null,
    notifier: deps.notifier ?? null,
  });
  return new TelephoneBidBookingService(
    new TelephoneBidBookingBuyerService(ctx),
    new TelephoneBidBookingStaffService(ctx),
    new TelephoneBidBookingQueryService(ctx),
    new TelephoneBidBookingSaleroomBridgeService(ctx),
    new TelephoneBidBookingBidPolicyService(ctx),
  );
}

export class TelephoneBidBookingService implements ITelephoneBidBookingService {
  constructor(
    private readonly buyer: TelephoneBidBookingBuyerService,
    private readonly staff: TelephoneBidBookingStaffService,
    private readonly query: TelephoneBidBookingQueryService,
    private readonly saleroomBridge: TelephoneBidBookingSaleroomBridgeService,
    private readonly bidPolicy: TelephoneBidBookingBidPolicyService,
  ) {}

  requestBooking(input: Parameters<ITelephoneBidBookingService["requestBooking"]>[0]) {
    return this.buyer.requestBooking(input);
  }

  listMineForUser(userId: string): Promise<TelephoneBidBooking[]> {
    return this.buyer.listMineForUser(userId);
  }

  findMineForSale(saleId: string, userId: string): Promise<TelephoneBidBooking | null> {
    return this.buyer.findMineForSale(saleId, userId);
  }

  getDetailForUser(id: string, userId: string) {
    return this.buyer.getDetailForUser(id, userId);
  }

  addLotsOfInterest(input: Parameters<ITelephoneBidBookingService["addLotsOfInterest"]>[0]) {
    return this.buyer.addLotsOfInterest(input);
  }

  requestLimitIncrease(input: Parameters<ITelephoneBidBookingService["requestLimitIncrease"]>[0]) {
    return this.buyer.requestLimitIncrease(input);
  }

  cancelByBuyer(input: Parameters<ITelephoneBidBookingService["cancelByBuyer"]>[0]) {
    return this.buyer.cancelByBuyer(input);
  }

  listForSaleAdmin(saleId: string, status?: TelephoneBidBookingStatus) {
    return this.query.listForSaleAdmin(saleId, status);
  }

  listForCurrentLot(saleId: string, lotId: string) {
    return this.query.listForCurrentLot(saleId, lotId);
  }

  countPendingForSale(saleId: string): Promise<number> {
    return this.query.countPendingForSale(saleId);
  }

  countGlobalPending(): Promise<number> {
    return this.query.countGlobalPending();
  }

  confirm(input: Parameters<ITelephoneBidBookingService["confirm"]>[0]) {
    return this.staff.confirm(input);
  }

  assignClerk(input: Parameters<ITelephoneBidBookingService["assignClerk"]>[0]) {
    return this.staff.assignClerk(input);
  }

  updateNotes(input: Parameters<ITelephoneBidBookingService["updateNotes"]>[0]) {
    return this.staff.updateNotes(input);
  }

  approveLimitIncrease(input: Parameters<ITelephoneBidBookingService["approveLimitIncrease"]>[0]) {
    return this.staff.approveLimitIncrease(input);
  }

  startLine(input: Parameters<ITelephoneBidBookingService["startLine"]>[0]) {
    return this.staff.startLine(input);
  }

  completeLine(input: Parameters<ITelephoneBidBookingService["completeLine"]>[0]) {
    return this.staff.completeLine(input);
  }

  closeBooking(input: Parameters<ITelephoneBidBookingService["closeBooking"]>[0]) {
    return this.staff.closeBooking(input);
  }

  cancelByStaff(input: Parameters<ITelephoneBidBookingService["cancelByStaff"]>[0]) {
    return this.staff.cancelByStaff(input);
  }

  assertBookingBelongsToSale(bookingId: string, saleId: string) {
    return this.staff.assertBookingBelongsToSale(bookingId, saleId);
  }

  closeAllOpenForSale(saleId: string): Promise<number> {
    return this.saleroomBridge.closeAllOpenForSale(saleId);
  }

  completeLinesForLot(saleId: string, lotId: string): Promise<number> {
    return this.saleroomBridge.completeLinesForLot(saleId, lotId);
  }

  removeLotFromActiveBookings(saleId: string, lotId: string): Promise<number> {
    return this.saleroomBridge.removeLotFromActiveBookings(saleId, lotId);
  }

  assertBookingAllowsTelephoneBid(
    input: Parameters<ITelephoneBidBookingService["assertBookingAllowsTelephoneBid"]>[0],
  ) {
    return this.bidPolicy.assertBookingAllowsTelephoneBid(input);
  }
}
