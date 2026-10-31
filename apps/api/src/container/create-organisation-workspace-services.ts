import type { Database } from "@auction/db";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import {
  DrizzleAccountRecordSearchReader,
  DrizzleNeedsYouFactsReader,
  DrizzleUnsoldLotChoiceRepository,
} from "@auction/persistence/repositories";
import type { IMyBuyerAgentAuthorisationsService } from "../services/buyer-agents/my-buyer-agent-authorisations.service.js";
import { UnsoldChoiceDeadlines } from "../services/consignment-after-sale/unsold-choice-deadlines.js";
import type { IAccountRecordSearchService } from "../services/interfaces/account-record-search-service.js";
import type {
  IAccountNeedsYouService,
  INeedsYouService,
} from "../services/interfaces/needs-you-service.js";
import { AccountNeedsYouService } from "../services/organisation-workspace/account-needs-you.service.js";
import { AccountRecordSearchService } from "../services/organisation-workspace/account-record-search.service.js";
import { NeedsYouOrganisationReader } from "../services/organisation-workspace/needs-you-organisation.reader.js";
import { NeedsYouService } from "../services/organisation-workspace/needs-you.service.js";

/** What the client workspace reads across modules for the acting account. */
export type OrganisationWorkspaceServices = {
  search: IAccountRecordSearchService;
  needsYou: INeedsYouService;
  /** Needs you for each of the signed-in person's organisations, for the account switcher. */
  accountNeedsYou: IAccountNeedsYouService;
};

export function createOrganisationWorkspaceServices(input: {
  db: Database;
  legalEntities: Pick<ILegalEntityRepository, "findById" | "listActiveMembershipsForUser">;
  /** Whether payouts must be set up before a seller's lots go live (Stripe Connect configured). */
  connectEnforced: () => boolean;
  buyerAgentAuthorisations: IMyBuyerAgentAuthorisationsService;
}): OrganisationWorkspaceServices {
  const needsYou = new NeedsYouService({
    facts: new DrizzleNeedsYouFactsReader(input.db),
    organisations: new NeedsYouOrganisationReader({
      legalEntities: input.legalEntities,
      connectEnforced: input.connectEnforced,
    }),
    unsold: new DrizzleUnsoldLotChoiceRepository(input.db),
    deadlines: new UnsoldChoiceDeadlines(),
    authorisations: input.buyerAgentAuthorisations,
  });
  return {
    search: new AccountRecordSearchService(new DrizzleAccountRecordSearchReader(input.db)),
    needsYou,
    accountNeedsYou: new AccountNeedsYouService({ memberships: input.legalEntities, needsYou }),
  };
}
