import type { Database } from "@auction/db";
import type { Env } from "../env.js";
import { DrizzlePaddleBidWindowReader } from "../repositories/drizzle-paddle-bid-window.reader.js";
import { DrizzleSaleRegistrationCheckInReader } from "../repositories/drizzle-sale-registration-check-in.reader.js";
import { DrizzleTelephoneBidBookingDetailReader } from "../repositories/drizzle-telephone-bid-booking-detail.reader.js";
import { DrizzleTelephoneBookingUserPhoneReader } from "../repositories/drizzle-telephone-booking-user-phone.reader.js";
import { PaddleService } from "../services/paddle.service.js";
import { SaleExpectedGuestsService } from "../services/sale-expected-guests.service.js";
import { SaleroomCheckInEligibilityValidator } from "../services/saleroom-check-in-eligibility.validator.js";
import { SaleroomCheckInService } from "../services/saleroom-check-in.service.js";
import { TelephoneBidBookingService } from "../services/telephone-bid-booking.service.js";
import { TelephoneBookingNotifier } from "../services/telephone-booking-notifier.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerSaleRegistrationServices = {
  telephoneBidBookingService: TelephoneBidBookingService;
  paddleService: PaddleService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
};

export type CreateSaleRegistrationServicesInput = {
  env: Env;
  db: Database;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
};

export function createSaleRegistrationServices(
  input: CreateSaleRegistrationServicesInput,
): ContainerSaleRegistrationServices {
  const { env, db, infra, repos, platform, complianceMedia } = input;
  const { cache } = infra;
  const {
    lotRepo,
    saleRepo,
    telephoneBidBookingRepo,
    paddleRepo,
    saleroomCheckInRepo,
    saleExpectedGuestsReader,
    legalEntityRepository,
    amlHoldStore,
  } = repos;
  const { transactionalMailer, domainEventPublisher } = platform;
  const { kycService } = complianceMedia;

  const telephoneBookingNotifier = new TelephoneBookingNotifier(
    db,
    transactionalMailer,
    repos.notificationWriteRepo,
    env.WEB_ORIGIN,
    env.OPS_SUPPORT_EMAIL,
  );
  const telephoneBidBookingService = new TelephoneBidBookingService(
    db,
    telephoneBidBookingRepo,
    new DrizzleTelephoneBidBookingDetailReader(db),
    saleRepo,
    lotRepo,
    new DrizzleTelephoneBookingUserPhoneReader(db),
    legalEntityRepository,
    kycService,
    amlHoldStore,
    domainEventPublisher,
    telephoneBookingNotifier,
  );

  const paddleBidWindowReader = new DrizzlePaddleBidWindowReader(db);
  const paddleService = new PaddleService(paddleRepo, lotRepo, cache, (saleId, userId) =>
    paddleBidWindowReader.hasRecentSelfServiceBid(saleId, userId),
  );

  const saleroomCheckInEligibility = new SaleroomCheckInEligibilityValidator(
    new DrizzleSaleRegistrationCheckInReader(db),
    legalEntityRepository,
  );
  const saleroomCheckInService = new SaleroomCheckInService(
    saleroomCheckInRepo,
    saleroomCheckInEligibility,
    paddleService,
  );
  const saleExpectedGuestsService = new SaleExpectedGuestsService(saleExpectedGuestsReader);

  return {
    telephoneBidBookingService,
    paddleService,
    saleroomCheckInService,
    saleExpectedGuestsService,
  };
}
