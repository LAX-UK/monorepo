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

/** The accounts a person can switch between, and the places that manage them. */
export type AccountSwitcher = {
  options: AccountOption[];
  /** Organisation invitations waiting for an answer. */
  pendingInvitations: number;
  invitationsHref: string;
  /** Every account and invitation on one page. */
  accountsHref: string;
  registerHref: string;
};

/** What the Bid menu shows about whose account is in use. */
export type AccountChrome = {
  /** The account in use. */
  current: AccountOption;
  /**
   * The switcher, or `null` for people with no organisation: they have one account, so the menu
   * just shows their name and nothing can be switched.
   */
  switcher: AccountSwitcher | null;
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

/** The switcher for these accounts, with where its links go. */
export function buildAccountSwitcher(
  options: AccountOption[],
  pendingInvitations: number,
): AccountSwitcher {
  return {
    options,
    pendingInvitations,
    invitationsHref: CLIENT_ROUTES.invitations,
    accountsHref: CLIENT_ROUTES.organisations,
    registerHref: REGISTER_ORGANISATION_HREF,
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
      organisations.length > 0 ? buildAccountSwitcher(options, input.pendingInvitations) : null,
  };
}

/** From this many accounts the switcher offers a field to find one by name. */
export const ACCOUNT_FILTER_FROM = 6;

export function showsAccountFilter(options: readonly AccountOption[]): boolean {
  return options.length >= ACCOUNT_FILTER_FROM;
}

function folded(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** The accounts whose name or role contains the query, ignoring case and accents, in order. */
export function filterAccountOptions(
  options: readonly AccountOption[],
  query: string,
): AccountOption[] {
  const needle = folded(query.trim());
  if (!needle) return [...options];
  return options.filter((option) => folded(`${option.name} ${option.detail}`).includes(needle));
}

/**
 * A switcher row's two lines, as the design draws them: the person's own account leads with
 * their name and says "Personal" under it; an organisation leads with its name and the role.
 */
export function accountRowText(option: AccountOption): { title: string; caption: string } {
  return option.kind === "personal"
    ? { title: option.detail, caption: option.name }
    : { title: option.name, caption: option.detail };
}

/** The accessible name of an account's needs-you dot: "1 needs you", "2 need you". */
export function needsYouLabel(count: number): string {
  return `${count} ${count === 1 ? "needs" : "need"} you`;
}

/** The one heading and the one word for the account in use, on every switcher surface. */
export const SWITCH_ACCOUNT_HEADING = "Switch account";
export const CURRENT_ACCOUNT_LABEL = "Current";
/** Replaces the role line on the row being switched to. */
export const SWITCHING_LABEL = "Switching…";

/** The most a row's count shows before it reads "9+". */
const NEEDS_YOU_CAP = 9;

/** What a switcher row says, whichever surface draws it. */
export type AccountRowView = {
  title: string;
  /** The role (or "Personal"), or "Switching…" while this row's switch is in flight. */
  caption: string;
  /** The needs-you number as shown ("5", "9+"), or `null` when nothing needs the person. */
  needsText: string | null;
  /** Its accessible name ("5 need you"), or `null` with no count. */
  needsLabel: string | null;
  /** The account in use: shown as "Current" with a check. */
  current: boolean;
  pending: boolean;
};

export function accountRowView(
  option: AccountOption,
  state: { needs: number; pending: boolean },
): AccountRowView {
  const { title, caption } = accountRowText(option);
  const counted = state.needs > 0;
  const shown = state.needs > NEEDS_YOU_CAP ? `${NEEDS_YOU_CAP}+` : String(state.needs);
  return {
    title,
    caption: state.pending ? SWITCHING_LABEL : caption,
    needsText: counted ? shown : null,
    needsLabel: counted ? needsYouLabel(state.needs) : null,
    current: option.current,
    pending: state.pending,
  };
}

/** "Pending invitations (2)", capped so the row never grows. */
export function pendingInvitationsLabel(count: number): string {
  return `Pending invitations (${count > 9 ? "9+" : count})`;
}
