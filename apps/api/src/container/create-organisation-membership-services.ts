import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzleFormerMemberBidsRepository,
  DrizzleMemberWelcomeStore,
} from "@auction/persistence/repositories";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type {
  IFormerMemberBidsService,
  IMemberWelcomeService,
  IProxyCancelledRealtime,
} from "../services/interfaces/organisation-membership-service.js";
import { FormerMemberBidsService } from "../services/organisation-membership/former-member-bids.service.js";
import { MemberWelcomeService } from "../services/organisation-membership/member-welcome.service.js";

export type OrganisationMembershipServices = {
  welcome: IMemberWelcomeService;
  formerMemberBids: IFormerMemberBidsService;
};

/** A member's own welcome card, and the bids former members left for the organisation. */
export function createOrganisationMembershipServices(input: {
  db: Database;
  transactionRunner: ITransactionRunner;
  domainEventSink: IDomainEventSink;
  realtime: IProxyCancelledRealtime;
}): OrganisationMembershipServices {
  return {
    welcome: new MemberWelcomeService(new DrizzleMemberWelcomeStore(input.db)),
    formerMemberBids: new FormerMemberBidsService({
      bids: new DrizzleFormerMemberBidsRepository(input.db),
      transactions: input.transactionRunner,
      events: input.domainEventSink,
      realtime: input.realtime,
    }),
  };
}
