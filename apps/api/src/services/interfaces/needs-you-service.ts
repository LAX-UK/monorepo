import type { NeedsYouCounts, NeedsYouKind, NeedsYouLink, NeedsYouTask } from "@auction/domain";
import type { LegalEntityKind, LegalEntityStatus } from "@auction/types";
import type { OrganisationMemberActor } from "./organisation-membership-service.js";

/** A task with where its one button leads. */
export type NeedsYouTaskView = NeedsYouTask & { link: NeedsYouLink };

export type NeedsYouView = {
  /** Every kind this member could ever be asked to do; empty hides the section. */
  kinds: NeedsYouKind[];
  /** What waits now, in rank order. */
  tasks: NeedsYouTaskView[];
  /** The number on each sidebar item. */
  counts: NeedsYouCounts;
  /** Set when a list was longer than one read; the counts may then be low. */
  truncated: boolean;
};

/**
 * The acting account's standing as Needs you reads it: an organisation, or a person's own
 * account, whose state the domain reads by its kind.
 */
export interface INeedsYouOrganisationReader {
  standing(
    legalEntityId: string,
  ): Promise<{ kind: LegalEntityKind; status: LegalEntityStatus; payoutsReady: boolean } | null>;
}

/**
 * The one "Needs you" reader for the acting account: Home, the sidebar counts, Consignments'
 * Needs you view and the inbox's Needs action read it, so they always agree.
 */
export interface INeedsYouService {
  read(actor: OrganisationMemberActor): Promise<NeedsYouView>;
}

/** How many tasks wait on the person in one of their organisations. */
export type AccountNeedsYouCount = { legalEntityId: string; count: number };

/**
 * Needs you for each organisation the signed-in person belongs to, for the account switcher's
 * dots. Each account is read by the one reader above, as the member's own role in it.
 */
export interface IAccountNeedsYouService {
  countsFor(userId: string): Promise<AccountNeedsYouCount[]>;
}
