import { initials } from "@/components/organisations/initials";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import { organisationUnderReview } from "@auction/domain";
import type { LegalEntitySummary } from "@auction/types";
import { CLIENT_ROUTES } from "./client-routes";

/** One account in the switcher: the person's own, or an organisation they belong to. */
export type AccountOption = {
  id: string;
  kind: "personal" | "organisation";
  /** "Personal", or the organisation's name. */
  name: string;
  /** The person's name for their own account, or their role in the organisation ("Admin"). */
  detail: string;
  initials: string;
  current: boolean;
  /** LAX is checking the organisation's documents; bidding as it and sending its submissions wait. */
  underReview: boolean;
};

/** What the Bid menu shows about whose account is in use. */
export type AccountChrome = {
  /** The account in use. */
  current: AccountOption;
  /**
   * The switcher, or `null` for people with no organisation: they have one account, so the menu
   * just shows their name and nothing can be switched.
   */
  switcher: {
    options: AccountOption[];
    /** Organisation invitations waiting for an answer. */
    pendingInvitations: number;
    invitationsHref: string;
    registerHref: string;
  } | null;
};

type Input = {
  /** The person's name, shown for their personal account. */
  personName: string;
  memberships: readonly LegalEntitySummary[];
  /** The account in use; `null` falls back to the personal account. */
  actingId: string | null;
  /** When off, organisations are hidden everywhere, so a stale membership offers nothing. */
  orgModuleEnabled: boolean;
  pendingInvitations: number;
};

export const REGISTER_ORGANISATION_HREF = "/onboarding/organisation?fresh=1";

function personalOption(personName: string, id: string, current: boolean): AccountOption {
  return {
    id,
    kind: "personal",
    name: "Personal",
    detail: personName,
    initials: initials(personName),
    current,
    underReview: false,
  };
}

function organisationOption(member: LegalEntitySummary, current: boolean): AccountOption {
  const underReview = organisationUnderReview(member.status);
  const role = organisationRoleLabel(member.role);
  const note = organisationStatusView(member.status).switcherNote;
  return {
    id: member.id,
    kind: "organisation",
    name: member.displayName,
    detail: note ? `${role} · ${note}` : role,
    initials: initials(member.displayName),
    current,
    underReview,
  };
}

/** The account switcher for the signed-in person: the one place the chrome names the account. */
export function buildAccountChrome(input: Input): AccountChrome {
  const personal = input.memberships.find((m) => m.kind === "individual");
  const organisations = input.orgModuleEnabled
    ? input.memberships.filter((m) => m.kind === "organisation")
    : [];
  const actingOrganisation = organisations.find((m) => m.id === input.actingId) ?? null;

  const personalId = personal?.id ?? "personal";
  const options: AccountOption[] = [
    personalOption(input.personName, personalId, actingOrganisation === null),
    ...organisations.map((m) => organisationOption(m, m.id === actingOrganisation?.id)),
  ];
  const current = options.find((option) => option.current) ?? options[0];
  if (!current) throw new Error("account chrome needs a personal account");

  return {
    current,
    switcher:
      organisations.length > 0
        ? {
            options,
            pendingInvitations: input.pendingInvitations,
            invitationsHref: CLIENT_ROUTES.invitations,
            registerHref: REGISTER_ORGANISATION_HREF,
          }
        : null,
  };
}

/** "Pending invitations (2)", capped so the row never grows. */
export function pendingInvitationsLabel(count: number): string {
  return `Pending invitations (${count > 9 ? "9+" : count})`;
}
