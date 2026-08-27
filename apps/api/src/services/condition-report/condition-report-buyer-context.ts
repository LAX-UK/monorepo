import type { ISelfServiceIdentityEligibilityGate } from "@auction/bidding-runtime";
import type { IConditionReportRequestRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IDomainEventSink } from "../domain-event-sink.js";

export type ConditionReportBuyerContext = {
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  identityEligibilityGate: ISelfServiceIdentityEligibilityGate;
};

export function createConditionReportBuyerContext(input: {
  requestRepo: IConditionReportRequestRepository;
  lotRepo: ILotRepository;
  legalEntityRepository: ILegalEntityRepository | null;
  domainEventSink: IDomainEventSink | null;
  identityEligibilityGate: ISelfServiceIdentityEligibilityGate;
}): ConditionReportBuyerContext {
  return input;
}
