import type { IBidAuthority } from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import {
  DrizzlePaddleBidWindowReader,
  DrizzleSaleRegistrationCheckInReader,
  DrizzleTelephoneBidBookingDetailReader,
} from "@auction/persistence/repositories";
import { type Env, resolveStrictBidEligibilityEnabled } from "../env.js";
import { IdentityTelephoneBookingUserPhoneReader } from "../infrastructure/identity-telephone-booking-user-phone.reader.js";
import type { IIdentitySecurityClient } from "../services/interfaces/identity-issuer-client.js";
import type { TelephoneBidBookingServicePort } from "../services/interfaces/telephone-bid-booking-service.js";
import { PaddleService } from "../services/paddle.service.js";
import { SaleExpectedGuestsService } from "../services/sale-expected-guests.service.js";
import { SaleroomCheckInEligibilityValidator } from "../services/saleroom-check-in-eligibility.validator.js";
import { SaleroomCheckInService } from "../services/saleroom-check-in.service.js";
import { buildTelephoneBidBookingService } from "../services/telephone-bid-booking.service.js";
import { TelephoneBookingNotifier } from "../services/telephone-booking-notifier.js";
import { createBidAuthority, createBidIdentityEligibilityGate } from "./create-bid-eligibility.js";
import type { ContainerComplianceMedia } from "./create-compliance-media.js";
import type { ContainerInfra } from "./create-infra.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerSaleRegistrationServices = {
  /** Who may bid for a legal entity; every bidding channel shares this one instance. */
  bidAuthority: IBidAuthority;
  telephoneBidBookingService: TelephoneBidBookingServicePort;
  paddleService: PaddleService;
  saleroomCheckInService: SaleroomCheckInService;
  saleExpectedGuestsService: SaleExpectedGuestsService;
};

export type CreateSaleRegistrationServicesInput = {
  env: Env;
  db: Database;
  identitySecurity: IIdentitySecurityClient;
  infra: ContainerInfra;
  repos: ContainerRepositories;
  platform: ContainerPlatformServices;
  complianceMedia: ContainerComplianceMedia;
};

export function createSaleRegistrationServices(
  input: CreateSaleRegistrationServicesInput,
): ContainerSaleRegistrationServices {
  const { env, db, identitySecurity, infra, repos, platform, complianceMedia } = input;
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
  const { transactionalMailer, domainEventSink } = platform;
  const { kycService } = complianceMedia;

  const telephoneBookingNotifier = new TelephoneBookingNotifier(
    repos.userRepo,
    repos.saleRepo,
    transactionalMailer,
    repos.notificationWriteRepo,
    env.WEB_ORIGIN,
    env.OPS_SUPPORT_EMAIL,
  );
  const bidAuthority = createBidAuthority(db);
  const telephoneBidBookingService = buildTelephoneBidBookingService({
    repo: telephoneBidBookingRepo,
    detailReader: new DrizzleTelephoneBidBookingDetailReader(db),
    saleRepo,
    lotRepo,
    userPhoneReader: new IdentityTelephoneBookingUserPhoneReader(identitySecurity),
    legalEntityRepository,
    bidAuthority,
    identityEligibilityGate: createBidIdentityEligibilityGate(
      db,
      kycService,
      resolveStrictBidEligibilityEnabled(env),
    ),
    amlHoldStore,
    domainEventSink,
    notifier: telephoneBookingNotifier,
  });

  const paddleBidWindowReader = new DrizzlePaddleBidWindowReader(db);
  const paddleService = new PaddleService(
    paddleRepo,
    lotRepo,
    cache,
    bidAuthority,
    legalEntityRepository,
    (saleId, userId) => paddleBidWindowReader.hasRecentSelfServiceBid(saleId, userId),
  );

  const saleroomCheckInEligibility = new SaleroomCheckInEligibilityValidator(
    new DrizzleSaleRegistrationCheckInReader(db),
    legalEntityRepository,
    bidAuthority,
  );
  const saleroomCheckInService = new SaleroomCheckInService(
    saleroomCheckInRepo,
    saleroomCheckInEligibility,
    paddleService,
  );
  const saleExpectedGuestsService = new SaleExpectedGuestsService(saleExpectedGuestsReader);

  return {
    bidAuthority,
    telephoneBidBookingService,
    paddleService,
    saleroomCheckInService,
    saleExpectedGuestsService,
  };
}
