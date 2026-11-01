import type { Database } from "@auction/db";
import type {
  ILegalEntityConnectReader,
  ILegalEntityMemberRepository,
  IPayoutReadRepository,
} from "@auction/persistence/interfaces";
import {
  DrizzleContactDetailsRepository,
  DrizzleInvoiceDetailsRepository,
  DrizzleOrganisationActivityReader,
} from "@auction/persistence/repositories";
import type { IStripeClientFactory } from "../lib/stripe-client.js";
import type { IDomainEventSink } from "../services/domain-event-sink.js";
import type { IIdentityTwoFactorPolicyClient } from "../services/interfaces/identity-issuer-client.js";
import type {
  IContactDetailsService,
  IMemberLastActiveService,
  IOrganisationStatementsService,
  IPayoutAccountService,
} from "../services/interfaces/organisation-profile-service.js";
import type {
  IInvoiceDetailsService,
  IOrganisationActivityService,
} from "../services/interfaces/organisation-team-service.js";
import { ContactDetailsService } from "../services/organisation-team/contact-details.service.js";
import { InvoiceDetailsService } from "../services/organisation-team/invoice-details.service.js";
import { MemberLastActiveService } from "../services/organisation-team/member-last-active.service.js";
import { OrganisationActivityService } from "../services/organisation-team/organisation-activity.service.js";
import { OrganisationStatementsService } from "../services/organisation-team/organisation-statements.service.js";
import { PayoutAccountService } from "../services/organisation-team/payout-account.service.js";
import { StripePayoutBankAccountProvider } from "../services/stripe/connect/stripe-payout-bank-account.provider.js";

/** Team and Profile reads and changes for the acting organisation (`container.organisationTeam`). */
export type OrganisationTeamServices = {
  invoiceDetails: IInvoiceDetailsService;
  activity: IOrganisationActivityService;
  contactDetails: IContactDetailsService;
  statements: IOrganisationStatementsService;
  payoutAccount: IPayoutAccountService;
  memberLastActive: IMemberLastActiveService;
};

export function createOrganisationTeamServices(input: {
  db: Database;
  events: IDomainEventSink;
  payouts: Pick<IPayoutReadRepository, "list">;
  connect: Pick<ILegalEntityConnectReader, "findLegalEntityRowById">;
  stripeClientFactory: IStripeClientFactory;
  members: Pick<ILegalEntityMemberRepository, "listMembersWithUsers">;
  identity: Pick<IIdentityTwoFactorPolicyClient, "readSecuritySummaries">;
  log?: { warn: (obj: object, msg: string) => void };
}): OrganisationTeamServices {
  const warn = (msg: string) => (error: unknown, legalEntityId: string) =>
    input.log?.warn({ legalEntityId, err: error instanceof Error ? error.message : error }, msg);
  return {
    invoiceDetails: new InvoiceDetailsService({
      details: new DrizzleInvoiceDetailsRepository(input.db),
      events: input.events,
    }),
    activity: new OrganisationActivityService({
      activity: new DrizzleOrganisationActivityReader(input.db),
    }),
    contactDetails: new ContactDetailsService({
      details: new DrizzleContactDetailsRepository(input.db),
      events: input.events,
    }),
    statements: new OrganisationStatementsService({ payouts: input.payouts }),
    payoutAccount: new PayoutAccountService({
      connect: input.connect,
      provider: new StripePayoutBankAccountProvider(input.stripeClientFactory),
      onProviderError: warn("payout_bank_account_read_failed"),
    }),
    memberLastActive: new MemberLastActiveService({
      members: input.members,
      identity: input.identity,
      onIdentityError: warn("member_last_active_read_failed"),
    }),
  };
}
