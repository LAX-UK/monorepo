import { type OrganisationTab, organisationHref } from "./client-routes";
import {
  type SectionTabAccess,
  type SectionTabLink,
  type SectionTabSpec,
  defineSectionTabs,
} from "./section-tabs";

/**
 * The Organisation page's tabs, in order, with what a member needs to open each. The team moved
 * to its own Team page (see `team-tabs.ts`).
 */
const ORGANISATION_TAB_SPECS: readonly SectionTabSpec<OrganisationTab>[] = [
  { id: "profile", label: "Profile", capability: "entity.profile.read" },
  { id: "documents", label: "Documents", capability: "entity.profile.read" },
  { id: "payouts", label: "Payouts", capability: "entity.connect.operate" },
  // Admins see the policy read-only; only owners change it (`entity.security.manage`).
  { id: "security", label: "Security", capability: "entity.security.read" },
];

const ORGANISATION_TABS = defineSectionTabs(ORGANISATION_TAB_SPECS, (tab) => organisationHref(tab));

export type OrganisationTabLink = SectionTabLink<OrganisationTab>;
export type OrganisationTabAccess = SectionTabAccess<OrganisationTab>;

export const organisationTabsFor = ORGANISATION_TABS.tabsFor;
export const requireOrganisationTab = ORGANISATION_TABS.require;
export const organisationTabAt = ORGANISATION_TABS.tabAt;
export const ORGANISATION_PAGE_CAPABILITIES = ORGANISATION_TABS.capabilities;
