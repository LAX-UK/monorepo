import type { ActivityEntry } from "@auction/domain";
import type { InvoiceDetails, OrganisationAddress } from "@auction/persistence/interfaces";
import type {
  AddOrganisationAddressInput,
  OrganisationActivityQuery,
  UpdateInvoiceDetailsInput,
} from "@auction/validators";
import type { Result } from "neverthrow";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

export type OrganisationTeamError = {
  code: "forbidden";
  status: 403;
  message: string;
};

/** Invoice details as the Profile shows them, with whether this member may change them. */
export type InvoiceDetailsView = InvoiceDetails & { canEdit: boolean };

/** The details printed on the organisation's Bid invoices. */
export interface IInvoiceDetailsService {
  view(actor: OrganisationMemberActor): Promise<Result<InvoiceDetailsView, OrganisationTeamError>>;
  update(
    actor: OrganisationMemberActor,
    input: UpdateInvoiceDetailsInput,
  ): Promise<Result<InvoiceDetailsView, OrganisationTeamError>>;
}

/** The addresses a purchase can be delivered to for the organisation, and whether this member may add one. */
export type OrganisationAddressesView = { addresses: OrganisationAddress[]; canAdd: boolean };

/** The organisation's registered address and its delivery addresses, for the people who buy for it. */
export interface IOrganisationAddressService {
  list(
    actor: OrganisationMemberActor,
  ): Promise<Result<OrganisationAddressesView, OrganisationTeamError>>;
  add(
    actor: OrganisationMemberActor,
    input: AddOrganisationAddressInput,
  ): Promise<Result<OrganisationAddress, OrganisationTeamError>>;
}

/** An Activity line with the people in it named. */
export type ActivityEntryView = ActivityEntry & {
  /** The member's name, "LAX" for staff and the system. */
  actorName: string;
  subjectName: string | null;
};

export type ActivityPage = {
  entries: ActivityEntryView[];
  /** Pass as `before` for the next page; `null` on the last. */
  nextBefore: number | null;
};

/** The organisation's history, for owners and admins. */
export interface IOrganisationActivityService {
  list(
    actor: OrganisationMemberActor,
    query: OrganisationActivityQuery,
  ): Promise<Result<ActivityPage, OrganisationTeamError>>;
  /** Every entry matching the filters (up to a cap), as CSV text. */
  exportCsv(
    actor: OrganisationMemberActor,
    query: Omit<OrganisationActivityQuery, "before" | "limit">,
  ): Promise<Result<{ csv: string; truncated: boolean }, OrganisationTeamError>>;
}
