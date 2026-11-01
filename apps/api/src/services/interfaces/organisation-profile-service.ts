import type {
  PayoutBankAccountSummary,
  ProviderBankAccount,
  StatementAvailability,
  StatementKind,
} from "@auction/domain";
import type { ContactDetails } from "@auction/persistence/interfaces";
import type { UpdateContactDetailsInput } from "@auction/validators";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";
import type { OrganisationTeamError } from "./organisation-team-service.js";

/** Contact details as the Profile shows them, with whether this member may change them. */
export type ContactDetailsView = ContactDetails & { canEdit: boolean };

/** How buyers and LAX reach the organisation: read by every member, changed by owners and admins. */
export interface IContactDetailsService {
  view(actor: OrganisationMemberActor): Promise<Result<ContactDetailsView, OrganisationTeamError>>;
  update(
    actor: OrganisationMemberActor,
    input: UpdateContactDetailsInput,
  ): Promise<Result<ContactDetailsView, OrganisationTeamError>>;
}

/** One statement in the document library. Amounts are decimal strings in `currency`. */
export type StatementView = {
  kind: StatementKind;
  payoutId: string;
  periodStart: string;
  periodEnd: string;
  netAmount: string;
  currency: string;
  /** The payout's own state, so the library can say when money is still on its way. */
  payoutStatus: string;
  issuedAt: string;
  availability: StatementAvailability;
};

/** The organisation's statements, newest first, for the people who see its payouts. */
export interface IOrganisationStatementsService {
  list(actor: OrganisationMemberActor): Promise<Result<StatementView[], OrganisationTeamError>>;
}

/**
 * The payout provider's view of the bank account a connected account is paid into. Adapters
 * return the provider's fields as they are; the domain turns them into the client-safe summary.
 * They never return a full account number or sort code.
 */
export interface IPayoutBankAccountProvider {
  /** The account payouts go to, or `null` when none is added yet. */
  defaultBankAccount(connectedAccountId: string): Promise<ProviderBankAccount | null>;
}

/**
 * - `not_set_up`: there is no payout account yet;
 * - `none`: the payout account has no bank account yet;
 * - `unavailable`: the provider could not be asked just now;
 * - `ready`: the summary is in `account`.
 */
export type PayoutAccountView =
  | { state: "not_set_up" | "none" | "unavailable"; account: null }
  | { state: "ready"; account: PayoutBankAccountSummary };

/** Where the organisation's money goes, as a summary its owners, admins and finance may see. */
export interface IPayoutAccountService {
  view(actor: OrganisationMemberActor): Promise<Result<PayoutAccountView, OrganisationTeamError>>;
}

/** When each member was last active: the day only (`YYYY-MM-DD`), `null` when not known. */
export type MemberLastActive = { userId: string; lastActiveOn: string | null };

export type MemberLastActiveView = {
  /** `false` when the sign-in service could not be asked; `members` is then empty. */
  available: boolean;
  members: MemberLastActive[];
};

/** Last activity per member, for owners and admins. */
export interface IMemberLastActiveService {
  list(
    actor: OrganisationMemberActor,
  ): Promise<Result<MemberLastActiveView, OrganisationTeamError>>;
}
