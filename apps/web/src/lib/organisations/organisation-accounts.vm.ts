import { accountHomePathForKind } from "@/lib/navigation/account-home";
import { withAccount } from "@/lib/navigation/client-routes";
import { type HopHref, hopHref } from "@/lib/navigation/hop-href";
import { organisationRoleLabel } from "@/lib/presenters/organisation-role/organisation-role-presentation";
import { organisationStatusView } from "@/lib/presenters/organisation-status/organisation-status-presentation";
import { formatDate } from "@/lib/ui/format";
import type { LegalEntityStatus } from "@auction/types";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import { subkindLabel } from "./legal-entity-labels";
import { type SetupStep, setupStep } from "./organisation-setup";

/** The one badge a row shows, only while something about the account needs attention. */
export type AccountAttention = {
  label: string;
  tone: StatusBadgeTone;
  shape: StatusBadgeShape;
};

/** One account on "Your organisations": the person's own, or an organisation they belong to. */
export type AccountRowVm = {
  id: string;
  kind: "personal" | "organisation";
  title: string;
  /** The name the tile's initials come from: the person for their own account. */
  tileName: string;
  /** Facts after the title: what it is, the person's role, and "In use". */
  meta: string[];
  /**
   * The account's first page, opened in that account. Another account's page is a `HopHref`: it
   * switches account, so it is opened as a page load (see `AccountSwitchLink`).
   */
  href: string | HopHref;
  current: boolean;
  attention: AccountAttention | null;
  step: SetupStep | null;
};

export type OrganisationSource = {
  id: string;
  displayName: string;
  subkind: string;
  status: LegalEntityStatus;
  role: string;
  /** The onboarding step to resume at, when the organisation has one in progress. */
  resumeHref: string | null;
  /** An approved organisation still lacks payout details. */
  payoutDetailsNeeded: boolean;
};

export type PersonalSource = { id: string; displayName: string; subkind: string };

const IN_USE = "In use";

/**
 * An account's first page. The account in use opens as it is; any other names its account, which
 * the list switches to before loading the page (see `AccountSwitchLink`).
 */
function opensIn(path: string, accountId: string, current: boolean): string | HopHref {
  return current ? path : hopHref(withAccount(path, accountId));
}

/** An approved organisation has nothing to say; every other state is said once, in its own words. */
function attentionFor(source: OrganisationSource): AccountAttention | null {
  if (source.status !== "approved") {
    const view = organisationStatusView(source.status);
    return { label: view.label, tone: view.tone, shape: view.tone === "info" ? "dot" : "alert" };
  }
  return source.payoutDetailsNeeded
    ? { label: "Payout details needed", tone: "warning", shape: "alert" }
    : null;
}

/** The accounts as rows: the person's own first, then each organisation by name. */
export function accountRows(input: {
  personal: PersonalSource | null;
  organisations: readonly OrganisationSource[];
  actingId: string | null;
}): AccountRowVm[] {
  const actingOrganisation = input.organisations.some((o) => o.id === input.actingId);
  const rows: AccountRowVm[] = [];
  if (input.personal) {
    const current = !actingOrganisation;
    rows.push({
      id: input.personal.id,
      kind: "personal",
      title: "Personal",
      tileName: input.personal.displayName,
      meta: [input.personal.displayName, ...(current ? [IN_USE] : [])],
      href: opensIn(accountHomePathForKind("personal"), input.personal.id, current),
      current,
      attention: null,
      step: null,
    });
  }
  const sorted = [...input.organisations].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
  for (const source of sorted) {
    const current = source.id === input.actingId;
    rows.push({
      id: source.id,
      kind: "organisation",
      title: source.displayName,
      tileName: source.displayName,
      meta: [
        subkindLabel(source.subkind),
        organisationRoleLabel(source.role),
        ...(current ? [IN_USE] : []),
      ],
      href: opensIn(accountHomePathForKind("organisation"), source.id, current),
      current,
      attention: attentionFor(source),
      step: setupStep(source.status, source.id, source.resumeHref),
    });
  }
  return rows;
}

export type InvitationSource = {
  id: string;
  orgDisplayName: string;
  inviterName: string;
  roleOffered: string;
  expiresAt: string;
};

export type InvitationRowVm = {
  id: string;
  title: string;
  meta: string[];
  reviewHref: string;
};

/** Invitations waiting for an answer, soonest to expire first. */
export function invitationRows(invitations: readonly InvitationSource[]): InvitationRowVm[] {
  return [...invitations]
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
    .map((inv) => ({
      id: inv.id,
      title: inv.orgDisplayName,
      meta: [
        `From ${inv.inviterName}`,
        organisationRoleLabel(inv.roleOffered),
        `Expires ${formatDate(inv.expiresAt)}`,
      ],
      reviewHref: `/organisations/invitations/review/${encodeURIComponent(inv.id)}`,
    }));
}
