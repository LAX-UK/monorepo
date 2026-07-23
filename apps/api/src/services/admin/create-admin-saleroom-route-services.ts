import type { SaleroomOnBlockPolicy } from "@auction/bidding-runtime";
import type { IBidRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import type { AdminMetricsService } from "../admin-metrics.service.js";
import type { AdminSaleOperationsSnapshotService } from "../admin-sale-operations-snapshot.service.js";
import type {
  IAdminPaddleClerkOperations,
  IClerkPaddleBidSummaryPublisher,
  IClerkPaddleBidTelemetry,
} from "../interfaces/admin-live-bidding-ports.js";
import type { AdminOperationsRouteServices } from "../interfaces/admin-routes/admin-operations-routes.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";
import type { IBidPlacerWithIdempotency } from "../interfaces/place-bid.js";
import type { SaleroomServicePort } from "../interfaces/saleroom-service.js";
import type { ITelephoneBidBookingBidPolicy } from "../interfaces/telephone-bid-booking-service.js";
import type { PaddleService } from "../paddle.service.js";
import type { SaleExpectedGuestsService } from "../sale-expected-guests.service.js";
import type { SaleroomCheckInService } from "../saleroom-check-in.service.js";
import { AdminLiveBiddingApplicationService } from "./admin-live-bidding-application.service.js";
import { AdminSaleroomApplicationService } from "./admin-saleroom-application.service.js";
import { AdminSaleroomCheckInApplicationService } from "./admin-saleroom-check-in-application.service.js";
import { AdminSaleroomDisplayApplicationService } from "./admin-saleroom-display-application.service.js";
import { ClerkPaddleBidTelemetry } from "./clerk-paddle-bid-telemetry.js";

export type AdminSaleroomRouteServices = Pick<
  AdminOperationsRouteServices,
  "saleroom" | "saleroomCheckIn" | "liveBidding" | "display"
>;

export type CreateAdminSaleroomRouteServicesInput = {
  displayPairingService: IDisplayPairingService;
  displayOverlayService: IDisplayOverlayService;
  saleroomService: SaleroomServicePort;
  adminSaleOperationsSnapshotService: AdminSaleOperationsSnapshotService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
  bidPlacer: IBidPlacerWithIdempotency;
  saleroomOnBlockPolicy: SaleroomOnBlockPolicy;
  paddleClerk: IAdminPaddleClerkOperations;
  telephoneBidBookingService: ITelephoneBidBookingBidPolicy;
  adminMetricsService: AdminMetricsService;
  bidRepo: IBidRepository;
  redis: Redis;
  findLotById: (lotId: string) => Promise<{ id: string; saleId: string } | null>;
  clerkPaddleBidTelemetry?: IClerkPaddleBidTelemetry;
};

/** Live saleroom route services (session, check-in, clerk bidding, display). */
export function createAdminSaleroomRouteServices(
  input: CreateAdminSaleroomRouteServicesInput,
): AdminSaleroomRouteServices {
  const display = new AdminSaleroomDisplayApplicationService(
    input.displayPairingService,
    input.displayOverlayService,
  );
  const saleroom = new AdminSaleroomApplicationService(
    input.saleroomService,
    input.saleroomService,
    input.saleroomService,
    input.adminSaleOperationsSnapshotService,
  );
  const saleroomCheckIn = new AdminSaleroomCheckInApplicationService(
    input.saleroomCheckInService,
    input.saleExpectedGuestsService,
    input.redis,
  );
  const clerkPaddleBidSummaryPublisher: IClerkPaddleBidSummaryPublisher = {
    publishClerkPaddleBidSummary: (summary) => saleroom.publishClerkPaddleBidSummary(summary),
  };
  const liveBidding = new AdminLiveBiddingApplicationService({
    bidPlacer: input.bidPlacer,
    onBlockPolicy: input.saleroomOnBlockPolicy,
    paddleClerk: input.paddleClerk,
    telephoneBookings: input.telephoneBidBookingService,
    adminMetrics: input.adminMetricsService,
    bidRepo: input.bidRepo,
    redis: input.redis,
    findLotById: input.findLotById,
    clerkPaddleBidSummaryPublisher,
    clerkPaddleBidTelemetry: input.clerkPaddleBidTelemetry ?? new ClerkPaddleBidTelemetry(),
  });

  return { display, saleroom, saleroomCheckIn, liveBidding };
}

/** Adapts PaddleService to the clerk paddle port (assign/clear/roster/eligibility). */
export function paddleServiceAsClerkOperations(
  paddleService: PaddleService,
): IAdminPaddleClerkOperations {
  return paddleService;
}
