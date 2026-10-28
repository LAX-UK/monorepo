import type { Database } from "@auction/db";
import {
  DrizzleMemberWelcomeStore,
  DrizzleStoppedMemberBidsReader,
} from "@auction/persistence/repositories";
import type {
  IMemberWelcomeService,
  IStoppedMemberBidsQuery,
} from "../services/interfaces/organisation-membership-service.js";
import { MemberWelcomeService } from "../services/organisation-membership/member-welcome.service.js";
import { StoppedMemberBidsQuery } from "../services/organisation-membership/stopped-member-bids.query.js";

export type OrganisationMembershipServices = {
  welcome: IMemberWelcomeService;
  stoppedMemberBids: IStoppedMemberBidsQuery;
};

/** A member's own welcome card, and what stopped when members left the organisation. */
export function createOrganisationMembershipServices(input: {
  db: Database;
}): OrganisationMembershipServices {
  return {
    welcome: new MemberWelcomeService(new DrizzleMemberWelcomeStore(input.db)),
    stoppedMemberBids: new StoppedMemberBidsQuery(new DrizzleStoppedMemberBidsReader(input.db)),
  };
}
