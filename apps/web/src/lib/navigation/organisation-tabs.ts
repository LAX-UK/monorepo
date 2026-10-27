import { type EntityCapability, entityRoleCan } from "@auction/domain";
import type { LegalEntityMemberRole } from "@auction/types";
import { type OrganisationTab, organisationHref } from "./client-routes";

type TabSpec = {
  id: OrganisationTab;
  label: string;
  /** A member needs at least one of these to see the tab. */
  anyCapability: readonly EntityCapability[];
};

/**
 * The Organisation page's tabs, in order, with what a member needs to see each. Adding a tab or
 * moving who sees it is one row here; the page, the menu and the tests read this table.
 */
const ORGANISATION_TAB_SPECS: readonly TabSpec[] = [
  { id: "profile", label: "Profile", anyCapability: ["entity.members.manage"] },
  { id: "members", label: "Members", anyCapability: ["entity.members.manage"] },
  // KYB documents have no capability of their own; the people who manage members manage them.
  { id: "documents", label: "Documents", anyCapability: ["entity.members.manage"] },
  { id: "payouts", label: "Payouts", anyCapability: ["entity.connect.operate"] },
  // Admins see the policy read-only; only owners change it (`entity.security.manage`).
  { id: "security", label: "Security", anyCapability: ["entity.security.read"] },
];

export type OrganisationTabLink = { id: OrganisationTab; label: string; href: string };

/** The tabs a member holding `role` may open, in page order. */
export function organisationTabsFor(role: LegalEntityMemberRole): OrganisationTabLink[] {
  return ORGANISATION_TAB_SPECS.filter((spec) =>
    spec.anyCapability.some((capability) => entityRoleCan(role, capability)),
  ).map((spec) => ({ id: spec.id, label: spec.label, href: organisationHref(spec.id) }));
}

/** Whether `role` may open one tab. */
export function canOpenOrganisationTab(role: LegalEntityMemberRole, tab: OrganisationTab): boolean {
  return organisationTabsFor(role).some((link) => link.id === tab);
}

/** Every capability that opens at least one tab; the menu shows Organisation to these members. */
export const ORGANISATION_PAGE_CAPABILITIES: readonly EntityCapability[] = [
  ...new Set(ORGANISATION_TAB_SPECS.flatMap((spec) => spec.anyCapability)),
];
