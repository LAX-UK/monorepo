import { roleGroupsSentence } from "@/lib/organisations/legal-entity-labels";
import {
  type EntityActor,
  type EntityCapability,
  entityActorCan,
  rolesWithCapability,
} from "@auction/domain";
import { type OrganisationTab, organisationHref } from "./client-routes";

type TabSpec = {
  id: OrganisationTab;
  label: string;
  /** What a member needs to open the tab. */
  capability: EntityCapability;
};

/**
 * The Organisation page's tabs, in order, with what a member needs to open each. Adding a tab or
 * moving who opens it is one row here; the layout, every tab page, the menu and the tests read
 * this table. Reading capabilities let support staff viewing as the client open what the client
 * sees; the actions inside each tab ask for their own write capability.
 */
const ORGANISATION_TAB_SPECS: readonly TabSpec[] = [
  { id: "profile", label: "Profile", capability: "entity.profile.read" },
  { id: "members", label: "Members", capability: "entity.members.read" },
  { id: "documents", label: "Documents", capability: "entity.profile.read" },
  { id: "payouts", label: "Payouts", capability: "entity.connect.operate" },
  // Admins see the policy read-only; only owners change it (`entity.security.manage`).
  { id: "security", label: "Security", capability: "entity.security.read" },
];

export type OrganisationTabLink = { id: OrganisationTab; label: string; href: string };

function specFor(tab: OrganisationTab): TabSpec {
  const spec = ORGANISATION_TAB_SPECS.find((s) => s.id === tab);
  if (!spec) throw new Error(`Unknown organisation tab: ${tab}`);
  return spec;
}

/** The tabs `actor` may open, in page order. */
export function organisationTabsFor(actor: EntityActor): OrganisationTabLink[] {
  return ORGANISATION_TAB_SPECS.filter((spec) => entityActorCan(actor, spec.capability)).map(
    (spec) => ({ id: spec.id, label: spec.label, href: organisationHref(spec.id) }),
  );
}

export type OrganisationTabAccess =
  | { kind: "open" }
  | {
      kind: "forbidden";
      /** The tab's name, for "You don't have access to Members". */
      label: string;
      /** Who can open it, for "Owners and admins can open it". */
      openedBy: string;
      /** The first tab the person can open, if any, to send them on to. */
      fallback: OrganisationTabLink | null;
    };

/**
 * Whether `actor` may open `tab`. Every tab page asks this before loading anything, so a tab
 * that is not listed for someone cannot be opened by its address either.
 */
export function requireOrganisationTab(
  actor: EntityActor,
  tab: OrganisationTab,
): OrganisationTabAccess {
  const spec = specFor(tab);
  if (entityActorCan(actor, spec.capability)) return { kind: "open" };
  return {
    kind: "forbidden",
    label: spec.label,
    openedBy: roleGroupsSentence(rolesWithCapability(spec.capability)),
    fallback: organisationTabsFor(actor)[0] ?? null,
  };
}

/** Every capability that opens at least one tab; the menu shows Organisation to these members. */
export const ORGANISATION_PAGE_CAPABILITIES: readonly EntityCapability[] = [
  ...new Set(ORGANISATION_TAB_SPECS.map((spec) => spec.capability)),
];
