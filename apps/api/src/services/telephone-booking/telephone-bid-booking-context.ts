import type { ITelephoneBookingUserPhoneReader } from "@auction/persistence";
import type { ITelephoneBidBookingDetailReader } from "../../repositories/interfaces/telephone-bid-booking-detail.reader.js";
import type { ITelephoneBidBookingRepository } from "../../repositories/interfaces/telephone-bid-booking.repository.js";
import type { IAmlHoldStore } from "../aml/ports.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { ILotRepository, ISaleRepository } from "../interfaces/repositories.js";
import type { ITelephoneBookingNotifier } from "../interfaces/telephone-booking-notifier.js";
import type { TelephoneBookingEventsDeps } from "./telephone-booking-events.js";
import type { TelephoneBookingValidationDeps } from "./telephone-booking-validation.js";

export type TelephoneBidBookingContext = {
  repo: ITelephoneBidBookingRepository;
  detailReader: ITelephoneBidBookingDetailReader;
  validationDeps: TelephoneBookingValidationDeps;
  eventsDeps: TelephoneBookingEventsDeps;
};

export function createTelephoneBidBookingContext(input: {
  repo: ITelephoneBidBookingRepository;
  detailReader: ITelephoneBidBookingDetailReader;
  saleRepo: ISaleRepository;
  lotRepo: ILotRepository;
  userPhoneReader: ITelephoneBookingUserPhoneReader;
  legalEntityRepository: ILegalEntityRepository;
  kycService: IKycService | null;
  amlHoldStore: IAmlHoldStore | null;
  domainEventSink: IDomainEventSink | null;
  notifier: ITelephoneBookingNotifier | null;
}): TelephoneBidBookingContext {
  return {
    repo: input.repo,
    detailReader: input.detailReader,
    validationDeps: {
      repo: input.repo,
      legalEntityRepository: input.legalEntityRepository,
      kycService: input.kycService,
      amlHoldStore: input.amlHoldStore,
      saleRepo: input.saleRepo,
      lotRepo: input.lotRepo,
      userPhoneReader: input.userPhoneReader,
    },
    eventsDeps: {
      domainEventSink: input.domainEventSink,
      notifier: input.notifier,
    },
  };
}
